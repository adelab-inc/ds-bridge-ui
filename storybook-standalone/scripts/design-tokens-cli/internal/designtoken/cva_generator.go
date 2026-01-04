// Package designtoken provides CVA-based React component generation from Figma Design Tokens
package designtoken

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"text/template"
	"time"
)

// CVAGenerator는 Figma 토큰을 CVA 기반 React 컴포넌트로 변환하는 생성기입니다
type CVAGenerator struct {
	collections   map[string]*DesignTokenCollection
	aliasResolver *AliasResolver
}

// CVAGenerationOptions는 CVA 생성 옵션을 정의합니다
type CVAGenerationOptions struct {
	OutputDir string
	Verbose   bool
}

// CVAGenerationResult는 CVA 생성 결과를 담습니다
type CVAGenerationResult struct {
	Success        bool            `json:"success"`
	OutputDir      string          `json:"output_dir"`
	GeneratedFiles []GeneratedFile `json:"generated_files"`
	TokensFound    int             `json:"tokens_found"`
	Errors         []string        `json:"errors"`
	Warnings       []string        `json:"warnings"`
}

// FigmaToken represents a preserved Figma token with original naming
type FigmaToken struct {
	Name        string      `json:"name"`
	Value       interface{} `json:"value"`
	Type        string      `json:"type"`
	Description string      `json:"description,omitempty"`
}

// DesignToken represents a TailwindCSS-compatible token
type DesignToken struct {
	TailwindName string      `json:"tailwind_name"`
	Value        interface{} `json:"value"`
	OriginalName string      `json:"original_name"`
	Category     string      `json:"category"`
}

// TokenMapping represents the relationship between Figma and Tailwind tokens
type TokenMapping struct {
	TailwindName string `json:"tailwind_name"`
	FigmaName    string `json:"figma_name"`
}

// DesignTokensJSON represents the JSON structure for design tokens (design-validator MCP용)
type DesignTokensJSON struct {
	DesignTokens map[string]map[string]interface{} `json:"designTokens"`
	TokenMapping map[string]string                 `json:"tokenMapping"`
	Metadata     DesignTokensMetadata              `json:"metadata"`
}

// DesignTokensMetadata contains generation metadata
type DesignTokensMetadata struct {
	GeneratedAt string `json:"generatedAt"`
	Generator   string `json:"generator"`
	Version     string `json:"version"`
}

// NewCVAGenerator creates a new CVA generator
func NewCVAGenerator() *CVAGenerator {
	return &CVAGenerator{
		collections: make(map[string]*DesignTokenCollection),
		aliasResolver: &AliasResolver{
			variables: make(map[string]*DesignTokenVariable),
		},
	}
}

// Generate generates CVA-based React components from token collections
func (cg *CVAGenerator) Generate(collections map[string]*DesignTokenCollection, options *CVAGenerationOptions, generateUI bool) (*CVAGenerationResult, error) {
	result := &CVAGenerationResult{
		OutputDir:      options.OutputDir,
		GeneratedFiles: []GeneratedFile{},
		Errors:         []string{},
		Warnings:       []string{},
	}

	cg.collections = collections

	if err := cg.buildAliasMap(); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("별칭 맵 생성 실패: %v", err))
		return result, nil
	}

	if err := cg.createDirectories(options.OutputDir); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("디렉터리 생성 실패: %v", err))
		return result, nil
	}

	if err := cg.generateTokenFiles(options, result); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("토큰 파일 생성 실패: %v", err))
	}

	if generateUI {
		if err := cg.generateUtilityFiles(options, result); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("유틸리티 파일 생성 실패: %v", err))
		}
		if err := cg.generateReactComponents(options, result); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("React 컴포넌트 생성 실패: %v", err))
		}
		if err := cg.generateStorybookFiles(options, result); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Storybook 파일 생성 실패: %v", err))
		}
		if err := cg.generateTailwindConfigs(options, result); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Tailwind 설정 생성 실패: %v", err))
		}

		// Run Token Relationship Analysis
		analyzer := NewRelationshipAnalyzer()
		definedTokenNames := make(map[string]bool)

		// Populate definedTokenNames with alias resolution
		for _, collection := range cg.collections {
			for _, variable := range collection.Variables {
				tailwindName := cg.convertFigmaNameToTailwind(variable)
				definedTokenNames[tailwindName] = true

				// Resolve alias and add the resolved palette token name as well
				resolvedValue := cg.resolveValue(variable)
				if strValue, ok := resolvedValue.(string); ok {
					// Example resolved value: "palette.neutral-gray-900"
					// Extract the core token name: "neutral-gray-900"
					if strings.HasPrefix(strValue, "palette.") {
						parts := strings.Split(strValue, ".")
						if len(parts) > 1 {
							resolvedTokenName := strings.Join(parts[1:], "-")
							definedTokenNames[resolvedTokenName] = true
						}
					}
				}
			}
		}

		// Add hardcoded preset color names to avoid false positives
		presetColors := []string{
			"card", "card-foreground", "popover", "popover-foreground",
			"primary", "primary-foreground", "secondary", "secondary-foreground",
			"muted", "muted-foreground", "accent", "accent-foreground",
			"destructive", "destructive-foreground", "border", "input", "ring",
			"background", "foreground",
		}
		for _, color := range presetColors {
			definedTokenNames[color] = true
		}

		definitionsPath := filepath.Join(options.OutputDir, "design-tokens", "component-definitions.json")
		analysisResult, err := analyzer.Analyze(definitionsPath, definedTokenNames)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Token analysis failed: %v", err))
		} else {
			if analysisResult != nil {
				for _, ref := range analysisResult.DanglingReferences {
					result.Warnings = append(result.Warnings, fmt.Sprintf("Dangling reference found: Token '%s' is used in component definitions but not defined.", ref))
				}
				for _, token := range analysisResult.UnusedTokens {
					result.Warnings = append(result.Warnings, fmt.Sprintf("Unused token found: Token '%s' is defined but never used in component definitions.", token))
				}
			}
		}

		if len(result.Warnings) > 0 || len(result.Errors) > 0 {
			if err := cg.generateValidationReport(options, result); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("검증 리포트 생성 실패: %v", err))
			}
		}
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

// buildAliasMap builds the alias resolver map from all collections
func (cg *CVAGenerator) buildAliasMap() error {
	for _, collection := range cg.collections {
		for i := range collection.Variables {
			variable := &collection.Variables[i]
			cg.aliasResolver.variables[variable.ID] = variable
		}
	}
	return nil
}

// createDirectories creates the necessary output directories
func (cg *CVAGenerator) createDirectories(outputDir string) error {
	dirs := []string{
		filepath.Join(outputDir, "components"),
		filepath.Join(outputDir, "stories"),
		filepath.Join(outputDir, "tokens"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("디렉터리 생성 실패 %s: %v", dir, err)
		}
	}

	return nil
}

// extractFigmaTokens extracts all tokens with original Figma names preserved
func (cg *CVAGenerator) extractFigmaTokens() []FigmaToken {
	var tokens []FigmaToken

	for _, collection := range cg.collections {
		for _, variable := range collection.Variables {
			resolvedValue := cg.resolveValue(variable)

			token := FigmaToken{
				Name:        variable.Name,
				Value:       resolvedValue,
				Type:        variable.Type,
				Description: variable.Description,
			}

			tokens = append(tokens, token)
		}
	}

	sort.Slice(tokens, func(i, j int) bool {
		return tokens[i].Name < tokens[j].Name
	})

	return tokens
}

// extractDesignTokens converts Figma tokens to TailwindCSS-compatible tokens
func (cg *CVAGenerator) extractDesignTokens() (map[string]map[string]interface{}, []TokenMapping) {
	designTokens := map[string]map[string]interface{}{
		"fontSize":   make(map[string]interface{}),
		"colors":     make(map[string]interface{}),
		"spacing":    make(map[string]interface{}),
		"fontWeight": make(map[string]interface{}),
		"fontFamily": make(map[string]interface{}),
	}

	var mappings []TokenMapping

	for _, collection := range cg.collections {
		for _, variable := range collection.Variables {
			resolvedValue := cg.resolveValue(variable)
			tailwindName := cg.convertFigmaNameToTailwind(variable)

			mapping := TokenMapping{
				TailwindName: tailwindName,
				FigmaName:    variable.Name,
			}
			mappings = append(mappings, mapping)

			switch {
			case variable.Type == "TYPOGRAPHY":
				if values, ok := resolvedValue.(map[string]interface{}); ok {
					fontSize, fsOk := values["fontSize"].(string)
					lineHeight, lhOk := values["lineHeight"].(string)
					if fsOk && lhOk {
						designTokens["fontSize"][tailwindName] = []interface{}{
							fontSize,
							map[string]interface{}{
								"lineHeight": lineHeight,
							},
						}
					}
					if fontWeight, ok := values["fontWeight"].(string); ok {
						designTokens["fontWeight"][tailwindName] = cg.convertFontWeight(fontWeight)
					}
					if fontFamily, ok := values["fontFamily"].(string); ok {
						designTokens["fontFamily"][tailwindName] = []string{fontFamily, "sans-serif"}
					}
				}
			case strings.Contains(variable.Name, "color"):
				colorValue := cg.convertToHexColor(resolvedValue)
				if colorValue != "" {
					designTokens["colors"][tailwindName] = colorValue
				}

									                                    						case strings.Contains(variable.Name, "space"):

									                                    							if floatValue, ok := resolvedValue.(float64); ok {

									                                    								// Try to convert tailwindName to an integer.

									                                    								if intValue, err := strconv.Atoi(tailwindName); err == nil {

									                                    									// If successful, use the string representation of the integer as the key.

									                                    									designTokens["spacing"][fmt.Sprintf("%d", intValue)] = fmt.Sprintf("%.0fpx", floatValue)

									                                    								} else {

									                                    									// Otherwise, use the original string name.

									                                    									designTokens["spacing"][tailwindName] = fmt.Sprintf("%.0fpx", floatValue)

									                                    								}

									                                    							}			}
		}
	}

	sort.Slice(mappings, func(i, j int) bool {
		return mappings[i].TailwindName < mappings[j].TailwindName
	})

	return designTokens, mappings
}

// convertFigmaNameToTailwind converts Figma token names to TailwindCSS-compatible names
func (cg *CVAGenerator) convertFigmaNameToTailwind(variable DesignTokenVariable) string {
	figmaName := variable.Name
	if variable.Type == "TYPOGRAPHY" {
		return "typography-" + strings.ReplaceAll(figmaName, "/", "-")
	}

	parts := strings.Split(figmaName, "/")
	if len(parts) < 3 {
		return strings.ReplaceAll(figmaName, "/", "-")
	}

	var meaningfulParts []string
	switch {
	case strings.HasPrefix(figmaName, "font/size"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "font/weight"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "font/family"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "color/palette"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "color/role"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "space/scale"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "space/inset"):
		meaningfulParts = parts[2:]
	case strings.HasPrefix(figmaName, "space/stack"):
		meaningfulParts = append([]string{"stack"}, parts[2:]...)
	case strings.HasPrefix(figmaName, "space/inline"):
		meaningfulParts = append([]string{"inline"}, parts[2:]...)
	default:
		meaningfulParts = parts[1:]
	}

	return strings.Join(meaningfulParts, "-")
}

// resolveValue resolves token values including aliases
func (cg *CVAGenerator) resolveValue(variable DesignTokenVariable) interface{} {
	for _, value := range variable.ValuesByMode {
		if aliasMap, ok := value.(map[string]interface{}); ok {
			if aliasType, exists := aliasMap["type"]; exists && aliasType == "VARIABLE_ALIAS" {
				if aliasID, exists := aliasMap["id"]; exists {
					if aliasVar, found := cg.aliasResolver.variables[aliasID.(string)]; found {
						return cg.resolveValue(*aliasVar)
					}
				}
			}
		}
		return value
	}
	return nil
}

// convertToHexColor converts color values to HEX format, including alpha for RGBA
func (cg *CVAGenerator) convertToHexColor(value interface{}) string {
	if colorMap, ok := value.(map[string]interface{}); ok {
		rVal, rExists := colorMap["r"]
		gVal, gExists := colorMap["g"]
		bVal, bExists := colorMap["b"]

		if rExists && gExists && bExists {
			r := int(rVal.(float64) * 255)
			g := int(gVal.(float64) * 255)
			b := int(bVal.(float64) * 255)

			if aVal, aExists := colorMap["a"]; aExists && aVal.(float64) < 1.0 {
				a := int(aVal.(float64) * 255)
				return fmt.Sprintf("#%02x%02x%02x%02x", r, g, b, a)
			}
			return fmt.Sprintf("#%02x%02x%02x", r, g, b)
		}
	}
	if str, ok := value.(string); ok && strings.HasPrefix(str, "#") {
		return str
	}
	return ""
}

// convertFontWeight converts font weight strings to numbers
func (cg *CVAGenerator) convertFontWeight(weight string) int {
	weightMap := map[string]int{
		"Regular":  400,
		"Medium":   500,
		"SemiBold": 600,
		"Bold":     700,
	}

	if val, exists := weightMap[weight]; exists {
		return val
	}

	re := regexp.MustCompile(`\d+`)
	if match := re.FindString(weight); match != "" {
		if val := cg.parseIntSafe(match); val > 0 {
			return val
		}
	}

	return 400
}

// parseIntSafe safely parses string to int
func (cg *CVAGenerator) parseIntSafe(s string) int {
	result := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			result = result*10 + int(r-'0')
		}
	}
	return result
}

// generateTokenFiles generates all token-related files
func (cg *CVAGenerator) generateTokenFiles(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	if err := cg.generateStructuredTokensFile(options, result); err != nil {
		return err
	}
	if err := cg.generateDesignTokensFile(options, result); err != nil {
		return err
	}
	if err := cg.generateTypesFile(options, result); err != nil {
		return err
	}
	return nil
}

// generateStructuredTokensFile generates src/tokens/structured-tokens.ts and handles versioning.
func (cg *CVAGenerator) generateStructuredTokensFile(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	basePath := filepath.Dir(options.OutputDir)
	vm, err := NewVersionManager(basePath)
	if err != nil {
		return fmt.Errorf("failed to initialize version manager: %w", err)
	}

	var structuredBuilder strings.Builder
	for _, collectionName := range []string{"color", "space", "typography"} {
		collection, ok := cg.collections[collectionName]
		if !ok {
			continue
		}
		var content string
		var err error
		switch collection.Name {
		case "color":
			content, err = GenerateColorTokens(collection)
		case "space":
			content, err = GenerateSpaceTokens(collection)
		case "typography":
			content, err = GenerateTypographyTokens(collection)
		}
		if err != nil {
			return fmt.Errorf("%s structured token generation failed: %w", collection.Name, err)
		}
		structuredBuilder.WriteString(content)
		structuredBuilder.WriteString("\n")
	}

	tokenContent := structuredBuilder.String()

	nextVersion, needsUpdate, componentDefsChanged, err := vm.GetNextVersion(tokenContent)
	if err != nil {
		return fmt.Errorf("failed to determine next version: %w", err)
	}

	if !needsUpdate {
		result.Warnings = append(result.Warnings, "Token content and component definitions have not changed. No new version will be generated.")
		return nil
	}

	defsHash, err := getComponentDefsHash(vm.componentDefsPath)
	if err != nil {
		return fmt.Errorf("failed to get hash of component-definitions.json for writing: %w", err)
	}
	finalContent := fmt.Sprintf("// component-definitions-hash: %s\n%s", defsHash, tokenContent)

	filePath := vm.GetVersionedPath(nextVersion, "structured-tokens.ts")
	
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create versioned directory: %w", err)
	}

	if err := os.WriteFile(filePath, []byte(finalContent), 0644); err != nil {
		return fmt.Errorf("failed to write to %s: %v", filePath, err)
	}
	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path: filePath, Type: "structured-tokens", Description: "Versioned structured token file",
	})

	// Save a snapshot of the component definitions for future diffing
	defsSnapshotPath := vm.GetVersionedPath(nextVersion, "component-definitions.json")
	defsBytes, err := os.ReadFile(vm.componentDefsPath)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Could not read component definitions for snapshot: %v", err))
	} else {
		if err := os.WriteFile(defsSnapshotPath, defsBytes, 0644); err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to save component definitions snapshot: %v", err))
		}
	}

	changelogPath, err := vm.GenerateChangelog(vm.latestTokenVersion, nextVersion, finalContent, componentDefsChanged)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to generate changelog: %v", err))
	}
	if changelogPath != "" {
		result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
			Path: changelogPath, Type: "changelog", Description: "Design token changelog",
		})
	}

	if err := vm.UpdatePackageJSONVersion(nextVersion); err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to update package.json version: %v", err))
	}


	return nil
}


// generateDesignTokensFile generates src/tokens/design-tokens.ts  
func (cg *CVAGenerator) generateDesignTokensFile(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	designTokens, mappings := cg.extractDesignTokens()
	filePath := filepath.Join(options.OutputDir, "tokens", "design-tokens.ts")

	var content strings.Builder

	content.WriteString("// 🎯 TailwindCSS 호환 디자인 토큰\n")
	content.WriteString("// 자동 생성된 파일입니다. 직접 수정하지 마세요.\n\n")

	content.WriteString("export const designTokens = {\n")

	categories := []string{"fontSize", "colors", "spacing", "fontWeight", "fontFamily"}
	for i, category := range categories {
		if tokens, exists := designTokens[category]; exists && len(tokens) > 0 {
			content.WriteString(fmt.Sprintf("  %s: {\n", category))
			
			keys := make([]string, 0, len(tokens))
			for key := range tokens {
				keys = append(keys, key)
			}
			sort.Strings(keys)

			for j, key := range keys {
				content.WriteString(fmt.Sprintf("    \"%s\": ", key))
				
				switch value := tokens[key].(type) {
				case string:
					content.WriteString(fmt.Sprintf("\"%s\"", value))
				case int:
					content.WriteString(fmt.Sprintf("%d", value))
				case []string:
					jsonVal, _ := json.Marshal(value)
					content.WriteString(string(jsonVal))
				case []interface{}:
					jsonVal, _ := json.Marshal(value)
					content.WriteString(string(jsonVal))
				default:
					jsonVal, _ := json.Marshal(value)
					content.WriteString(string(jsonVal))
				}

				if j < len(keys)-1 {
					content.WriteString(",")
				}
				content.WriteString("\n")
			}
			content.WriteString("  }")

			if i < len(categories)-1 {
				content.WriteString(",")
			}
			content.WriteString("\n")
		}
	}
	content.WriteString("};\n\n")

	content.WriteString("// 🔗 Figma 토큰명 ↔ TailwindCSS 토큰명 매핑\n")
	content.WriteString("export const tokenMapping = {\n")
	for i, mapping := range mappings {
		content.WriteString(fmt.Sprintf("  \"%s\": \"%s\"", mapping.TailwindName, mapping.FigmaName))
		if i < len(mappings)-1 {
			content.WriteString(",")
		}
		content.WriteString("\n")
	}
	content.WriteString("} as const;\n\n")

	content.WriteString("// 🔄 TailwindCSS 토큰명 → Figma 토큰명 역방향 조회\n")
	content.WriteString("export const reverseMappig = Object.fromEntries(\n")
	content.WriteString("  Object.entries(tokenMapping).map(([tailwind, figma]) => [figma, tailwind])\n")
	content.WriteString(") as Record<string, string>;\n\n")

	content.WriteString("// 📝 TypeScript 타입 정의\n")
	content.WriteString("export type DesignTokenCategory = keyof typeof designTokens;\n")
	content.WriteString("export type TailwindTokenName = keyof typeof tokenMapping;\n")

	if err := os.WriteFile(filePath, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("design-tokens.ts 파일 쓰기 실패: %v", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        filePath,
		Type:        "design-tokens",
		Description: "TailwindCSS 호환 토큰 변환 파일 (개발자 사용)",
	})

	// design-tokens.json 생성 (design-validator MCP용)
	if err := cg.generateDesignTokensJSONFile(options, result, designTokens, mappings); err != nil {
		return fmt.Errorf("design-tokens.json 생성 실패: %w", err)
	}

	return nil
}

// generateDesignTokensJSONFile generates src/tokens/design-tokens.json for design-validator MCP
func (cg *CVAGenerator) generateDesignTokensJSONFile(
	options *CVAGenerationOptions,
	result *CVAGenerationResult,
	designTokens map[string]map[string]interface{},
	mappings []TokenMapping,
) error {
	jsonFilePath := filepath.Join(options.OutputDir, "tokens", "design-tokens.json")

	// TokenMapping 배열을 map으로 변환
	tokenMappingMap := make(map[string]string)
	for _, mapping := range mappings {
		tokenMappingMap[mapping.TailwindName] = mapping.FigmaName
	}

	// JSON 구조체 생성
	jsonData := DesignTokensJSON{
		DesignTokens: designTokens,
		TokenMapping: tokenMappingMap,
		Metadata: DesignTokensMetadata{
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			Generator:   "design-tokens-cli",
			Version:     "1.0.0",
		},
	}

	// JSON 직렬화 (들여쓰기 포함)
	jsonBytes, err := json.MarshalIndent(jsonData, "", "  ")
	if err != nil {
		return fmt.Errorf("JSON 직렬화 실패: %w", err)
	}

	// 파일 쓰기
	if err := os.WriteFile(jsonFilePath, jsonBytes, 0644); err != nil {
		return fmt.Errorf("design-tokens.json 파일 쓰기 실패: %w", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        jsonFilePath,
		Type:        "design-tokens-json",
		Description: "JSON 형식 디자인 토큰 파일 (design-validator MCP용)",
	})

	return nil
}

// generateTypesFile generates src/tokens/types.ts
func (cg *CVAGenerator) generateTypesFile(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	filePath := filepath.Join(options.OutputDir, "tokens", "types.ts")

	var content strings.Builder

	content.WriteString("// 📝 디자인 토큰 TypeScript 타입 정의\n")
	content.WriteString("// 자동 생성된 파일입니다. 직접 수정하지 마세요.\n\n")

	content.WriteString("import { designTokens } from './design-tokens';\n\n")

	content.WriteString("// 🎯 기본 토큰 타입들\n")
	content.WriteString("export type FontSize = keyof typeof designTokens.fontSize;\n")
	content.WriteString("export type Colors = keyof typeof designTokens.colors;\n")
	content.WriteString("export type Spacing = keyof typeof designTokens.spacing;\n")
	content.WriteString("export type FontWeight = keyof typeof designTokens.fontWeight;\n")
	content.WriteString("export type FontFamily = keyof typeof designTokens.fontFamily;\n\n")

	content.WriteString("// 🛠️ 유틸리티 타입들\n")
	content.WriteString("export type ClassName = string | undefined | null | false;\n")
	content.WriteString("export type ClassNameArray = ClassName[];\n")
	content.WriteString("export type ClassValue = ClassName | ClassNameArray | Record<string, boolean>;\n")

	if err := os.WriteFile(filePath, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("types.ts 파일 쓰기 실패: %v", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        filePath,
		Type:        "types",
		Description: "TypeScript 타입 정의 파일",
	})

	return nil
}

// generateUtilityFiles generates utility files like utils.ts
func (cg *CVAGenerator) generateUtilityFiles(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	return cg.generateUtilsFile(options, result)
}

// generateUtilsFile generates src/components/utils.ts
func (cg *CVAGenerator) generateUtilsFile(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	filePath := filepath.Join(options.OutputDir, "components", "utils.ts")

	content := `// 🛠️ CVA 컴포넌트 유틸리티 함수
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx and tailwind-merge for optimal className handling
 *
 * Features:
 * - clsx: conditional classes, arrays, objects
 * - twMerge: resolves Tailwind CSS class conflicts
 *
 * Usage:
 * cn("px-4 py-2", { "bg-blue-500": isActive }, "text-white")
 * cn(["flex", "items-center"], className)
 */
export function cn(...inputs: ClassValue[]) {
  const merged = clsx(inputs);
  // text-로 시작하는 클래스는 twMerge의 충돌 해결 로직을 우회
  // (tailwind-merge가 bg-와 text-를 같은 그룹으로 오인하여 text-를 제거하는 문제 해결)
  if (merged.includes('text-')) {
    return merged;
  }
  return twMerge(merged);
}
`

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("utils.ts 파일 쓰기 실패: %v", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        filePath,
		Type:        "utils",
		Description: "CVA 유틸리티 함수 (cn)",
	})

	return nil
}

// generateReactComponents generates React components based on templates
func (cg *CVAGenerator) generateReactComponents(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	definitionsPath := filepath.Join(options.OutputDir, "design-tokens", "component-definitions.json")
	defsFile, err := os.ReadFile(definitionsPath)
	if err != nil {
		return fmt.Errorf("component-definitions.json 파일 읽기 실패: %w", err)
	}

	var componentDefs map[string]json.RawMessage
	if err := json.Unmarshal(defsFile, &componentDefs); err != nil {
		return fmt.Errorf("component-definitions.json 파싱 실패: %w", err)
	}

	templateDir := "scripts/design-tokens-cli/templates/components"

	for componentName, def := range componentDefs {
		templatePath := filepath.Join(templateDir, fmt.Sprintf("%s.template.tsx", componentName))
		
		if _, err := os.Stat(templatePath); os.IsNotExist(err) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("%s에 대한 템플릿 파일이 없어 컴포넌트 생성을 건너뜁니다.", componentName))
			continue
		}

		if err := cg.generateComponentFromTemplate(componentName, templatePath, def, options, result); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s 컴포넌트 생성 실패: %v", componentName, err))
		}
	}

	return nil
}

func (cg *CVAGenerator) generateComponentFromTemplate(componentName, templatePath string, componentDef json.RawMessage, options *CVAGenerationOptions, result *CVAGenerationResult) error {
	templateContent, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("템플릿 파일 읽기 실패 %s: %w", templatePath, err)
	}

	cvaArgsString, cvaBaseString, err := cg.buildCvaArgsString(componentDef)
	if err != nil {
		return fmt.Errorf("%s CVA 인자 문자열 빌드 실패: %w", componentName, err)
	}

	pascalComponentName := strings.Title(componentName)
	componentBaseDir := filepath.Join(options.OutputDir, "components") // 기본 출력 디렉토리

	parts := strings.Split(componentName, ".")
	if len(parts) > 1 {
		// "pagination.numberButton" -> groupName: "Pagination", fileName: "NumberButton"
		groupName := strings.Title(parts[0])
		fileName := parts[1]
		pascalComponentName = strings.Title(fileName)
		componentBaseDir = filepath.Join(componentBaseDir, groupName) // 하위 디렉토리 추가
	} else if componentName == "pagination" {
		pascalComponentName = "Pagination"
		componentBaseDir = filepath.Join(componentBaseDir, "Pagination")
	}
	// else의 경우, componentBaseDir는 그대로 packages/ui/src/components가 됩니다.

	camelComponentName := strings.ToLower(string(pascalComponentName[0])) + pascalComponentName[1:]

	data := struct {
		COMPONENT_NAME string
		CVA_NAME       string
		CVA_ARGS       string
		CVA_BASE       string
	}{
		COMPONENT_NAME: pascalComponentName,
		CVA_NAME:       fmt.Sprintf("%sVariants", camelComponentName),
		CVA_ARGS:       cvaArgsString,
		CVA_BASE:       fmt.Sprintf("'%s'", cvaBaseString),
	}

	tmpl, err := template.New(componentName).Parse(string(templateContent))
	if err != nil {
		return fmt.Errorf("템플릿 파싱 실패 %s: %w", templatePath, err)
	}

	var finalContentBuilder strings.Builder
	if err := tmpl.Execute(&finalContentBuilder, data); err != nil {
		return fmt.Errorf("템플릿 실행 실패 %s: %w", templatePath, err)
	}

	// 최종 파일 경로 설정
	finalFilePath := filepath.Join(componentBaseDir, fmt.Sprintf("%s.tsx", pascalComponentName))

	// Ensure the directory exists before writing the file
	if err := os.MkdirAll(filepath.Dir(finalFilePath), 0755); err != nil {
		return fmt.Errorf("디렉터리 생성 실패 %s: %v", filepath.Dir(finalFilePath), err)
	}

	if err := os.WriteFile(finalFilePath, []byte(finalContentBuilder.String()), 0644); err != nil {
		return fmt.Errorf("%s.tsx 파일 쓰기 실패: %v", pascalComponentName, err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        finalFilePath,
		Type:        "component",
		Description: fmt.Sprintf("%s 컴포넌트 (템플릿 기반)", pascalComponentName),
	})

	return nil
}

func (cg *CVAGenerator) buildCvaArgsString(componentDef json.RawMessage) (string, string, error) {
	var def struct {
		Base             string                                 `json:"base"`
		Variants         map[string]map[string]interface{}      `json:"variants"`
		DefaultVariants  map[string]interface{}                 `json:"defaultVariants"`
		CompoundVariants []map[string]interface{} `json:"compoundVariants"`
	}
	if err := json.Unmarshal(componentDef, &def); err != nil {
		return "", "", fmt.Errorf("component definition 파싱 실패: %w", err)
	}

	var builder strings.Builder
	builder.WriteString("({\n")
	builder.WriteString("    variants: {\n")

	for variantName, options := range def.Variants {
		builder.WriteString(fmt.Sprintf("      \"%s\": {\n", variantName))
		keys := make([]string, 0, len(options))
		for k := range options {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, key := range keys {
			builder.WriteString(fmt.Sprintf("        \"%s\": \"%s\",\n", key, options[key]))
		}
		builder.WriteString("      },\n")
	}
	builder.WriteString("    },\n")

	builder.WriteString("    defaultVariants: {\n")
	keys := make([]string, 0, len(def.DefaultVariants))
	for k := range def.DefaultVariants {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := def.DefaultVariants[key]
		if b, ok := value.(bool); ok {
			builder.WriteString(fmt.Sprintf("      \"%s\": %t,\n", key, b))
		} else {
			builder.WriteString(fmt.Sprintf("      \"%s\": \"%v\",\n", key, value))
		}
	}
	builder.WriteString("    },\n")

	if len(def.CompoundVariants) > 0 {
		builder.WriteString("    compoundVariants: [\n")
		for _, cv := range def.CompoundVariants {
			builder.WriteString("      {\n")
			keys := make([]string, 0, len(cv))
			for k := range cv {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			for _, key := range keys {
				value := cv[key]
				if b, ok := value.(bool); ok {
					builder.WriteString(fmt.Sprintf("        \"%s\": %t,\n", key, b))
				} else if key == "variant" {
					if variantValue, ok := value.([]interface{}); ok {
						var variantStrings []string
						for _, v := range variantValue {
							variantStrings = append(variantStrings, fmt.Sprintf("%v", v))
						}
						variantValueStr := fmt.Sprintf(`["%s"]`, strings.Join(variantStrings, `", "`))
						builder.WriteString(fmt.Sprintf("        \"variant\": %s,\n", variantValueStr))
					} else {
						builder.WriteString(fmt.Sprintf("        \"%s\": \"%v\",\n", key, value))
					}
				} else {
					builder.WriteString(fmt.Sprintf("        \"%s\": \"%v\",\n", key, value))
				}
			}
			builder.WriteString("      },\n")
		}
		builder.WriteString("    ],\n")
	}

	builder.WriteString("  })")

	return builder.String(), def.Base, nil
}
// generateStorybookFiles generates Storybook story files based on templates
func (cg *CVAGenerator) generateStorybookFiles(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	templateDir := "scripts/design-tokens-cli/templates/stories"
	files, err := os.ReadDir(templateDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("스토리 템플릿 디렉토리 읽기 실패 %s: %w", templateDir, err)
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".stories.template.tsx") {
			componentName := strings.TrimSuffix(file.Name(), ".stories.template.tsx")
			templatePath := filepath.Join(templateDir, file.Name())
			if err := cg.generateStoryFromTemplate(componentName, templatePath, options, result); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s 스토리 파일 생성 실패: %v", componentName, err))
			}
		}
	}
	return nil
}

type StoryTemplateData struct {
	COMPONENT_NAME string
	FileName       string
	ArgTypes       string
	DefaultArgs    string
	VariantStories []StoryInfo
	SizeStories    []StoryInfo
}

type StoryInfo struct {
	Name    string
	Variant string
	Size    string
}

func (cg *CVAGenerator) generateStoryFromTemplate(componentName, templatePath string, options *CVAGenerationOptions, result *CVAGenerationResult) error {
	pascalComponentName := strings.Title(componentName)
	componentDir := filepath.Join(options.OutputDir, "components")

	parts := strings.Split(componentName, ".")
	if len(parts) > 1 {
		groupName := strings.Title(parts[0])
		fileName := parts[1]
		pascalComponentName = strings.Title(fileName)
		componentDir = filepath.Join(componentDir, groupName)
	} else if componentName == "pagination" {
		pascalComponentName = "Pagination"
		componentDir = filepath.Join(componentDir, "Pagination")
	} else if componentName == "pagination" {
		pascalComponentName = "Pagination"
		componentDir = filepath.Join(componentDir, "Pagination")
	}
	componentPath := filepath.Join(componentDir, fmt.Sprintf("%s.tsx", pascalComponentName))
	componentContent, err := os.ReadFile(componentPath)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("컴포넌트 파일 읽기 실패 %s: %v. 스토리 파일 생성을 건너뜁니다.", componentPath, err))
		return nil
	}

	re := regexp.MustCompile(`(?s)variants: {\s*([\s\S]*?)\s*},\s*defaultVariants: {\s*([\s\S]*?)\s*}`)
	matches := re.FindStringSubmatch(string(componentContent))
	if len(matches) < 3 {
		return nil
	}
	variantsBlock := matches[1]
	defaultsBlock := matches[2]

	data := StoryTemplateData{
		COMPONENT_NAME: pascalComponentName,
		FileName:      pascalComponentName,
	}

	var argTypesBuilder strings.Builder
	variantRegex := regexp.MustCompile(`(\w+): {\s*([\s\S]*?)\s*},`)
	variantMatches := variantRegex.FindAllStringSubmatch(variantsBlock, -1)

	for _, match := range variantMatches {
		variantName := match[1]
		optionsStr := match[2]
		optionRegex := regexp.MustCompile(`(?m)^\s*(\w+):`)
		optionMatches := optionRegex.FindAllStringSubmatch(optionsStr, -1)
		
		var options []string
		for _, optMatch := range optionMatches {
			options = append(options, fmt.Sprintf("'%s'", optMatch[1]))
		}

		argTypesBuilder.WriteString(fmt.Sprintf("    %s: {\n      control: 'select',\n      options: [%s],\n    },\n", variantName, strings.Join(options, ", ")))

		storyType := "Variant"
		if variantName == "size" || variantName == "padding" {
			storyType = "Size"
		}

		for _, optMatch := range optionMatches {
			storyName := strings.Title(optMatch[1])
			if storyName != "Base" && storyName != "Default" {
				if storyType == "Variant" {
					data.VariantStories = append(data.VariantStories, StoryInfo{Name: storyName, Variant: optMatch[1]})
				} else {
					data.SizeStories = append(data.SizeStories, StoryInfo{Name: storyName, Size: optMatch[1]})
				}
			}
		}
	}
	data.ArgTypes = argTypesBuilder.String()

	defaultRegex := regexp.MustCompile(`(\w+):\s*"(\w+)" `)
	defaultMatches := defaultRegex.FindAllStringSubmatch(defaultsBlock, -1)
	var defaultArgsBuilder strings.Builder
	for _, match := range defaultMatches {
		defaultArgsBuilder.WriteString(fmt.Sprintf("%s: '%s',\n", match[1], match[2]))
	}
	data.DefaultArgs = defaultArgsBuilder.String()

	templateContent, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("스토리 템플릿 파일 읽기 실패 %s: %w", templatePath, err)
	}

	tmpl, err := template.New(componentName).Parse(string(templateContent))
	if err != nil {
		return fmt.Errorf("스토리 템플릿 파싱 실패 %s: %w", templatePath, err)
	}

	var finalContentBuilder strings.Builder
	if err := tmpl.Execute(&finalContentBuilder, data); err != nil {
		return fmt.Errorf("스토리 템플릿 실행 실패 %s: %w", componentName, err)
	}

	outputPath := filepath.Join(options.OutputDir, "stories", fmt.Sprintf("%s.stories.tsx", pascalComponentName))
	if err := os.WriteFile(outputPath, []byte(finalContentBuilder.String()), 0644); err != nil {
		return fmt.Errorf("%s.stories.tsx 파일 쓰기 실패: %v", componentName, err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        outputPath,
		Type:        "storybook-story",
		Description: fmt.Sprintf("%s 스토리 파일 (템플릿 기반)", strings.Title(componentName)),
	})

	return nil
}

func (cg *CVAGenerator) generateTailwindConfigs(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	presetGenerator := NewPresetGenerator(cg)
	presetOutputDir := filepath.Dir(options.OutputDir)
	if err := presetGenerator.Generate(presetOutputDir, result); err != nil {
		return fmt.Errorf("tailwind.preset.js 생성 실패: %v", err)
	}

	return nil
}

func (cg *CVAGenerator) generateValidationReport(options *CVAGenerationOptions, result *CVAGenerationResult) error {
	reportPath := filepath.Join(options.OutputDir, "token-validation-report.md")
	
	var content strings.Builder
	
	content.WriteString("# Figma 토큰 검증 리포트\n\n")
	
	content.WriteString("## 📊 검증 요약\n\n")
	content.WriteString(fmt.Sprintf("- **생성된 파일**: %d개\n", len(result.GeneratedFiles)))
	content.WriteString(fmt.Sprintf("- **경고**: %d개\n", len(result.Warnings)))
	content.WriteString(fmt.Sprintf("- **오류**: %d개\n", len(result.Errors)))

	var danglingRefs []string
	var unusedTokens []string
	var otherWarnings []string

	for _, warning := range result.Warnings {
		if strings.HasPrefix(warning, "Dangling reference found:") {
			danglingRefs = append(danglingRefs, warning)
		} else if strings.HasPrefix(warning, "Unused token found:") {
			unusedTokens = append(unusedTokens, warning)
		} else {
			otherWarnings = append(otherWarnings, warning)
		}
	}

	if len(danglingRefs) > 0 || len(unusedTokens) > 0 {
		content.WriteString("\n## 🔗 토큰 관계 분석\n\n")
		if len(danglingRefs) > 0 {
			content.WriteString("### ❗ 누락된 참조 (Dangling References)\n\n")
			content.WriteString("컴포넌트 정의에 사용되었지만, 실제로는 정의되지 않은 토큰들입니다.\n\n")
			for _, ref := range danglingRefs {
				content.WriteString(fmt.Sprintf("- %s\n", strings.TrimPrefix(ref, "Dangling reference found: ")))
			}
			content.WriteString("\n")
		}
		if len(unusedTokens) > 0 {
			content.WriteString("### 🗑️ 미사용 토큰 (Unused Tokens)\n\n")
			content.WriteString("정의되었지만, 어떤 컴포넌트에서도 사용되지 않는 토큰들입니다. 리팩토링 대상으로 고려해볼 수 있습니다.\n\n")
			for _, token := range unusedTokens {
				content.WriteString(fmt.Sprintf("- %s\n", strings.TrimPrefix(token, "Unused token found: ")))
			}
			content.WriteString("\n")
		}
	}
	
	if len(otherWarnings) > 0 {
		content.WriteString("\n## ⚠️ 기타 경고 사항\n\n")
		for i, warning := range otherWarnings {
			content.WriteString(fmt.Sprintf("%d. **%s**\n", i+1, warning))
		}
	}

	if len(result.Errors) > 0 {
		content.WriteString("\n## ❌ 오류 사항\n\n")
		for i, err := range result.Errors {
			content.WriteString(fmt.Sprintf("%d. **%s**\n", i+1, err))
		}
	}
	
	if err := os.WriteFile(reportPath, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("검증 리포트 파일 쓰기 실패: %v", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        reportPath,
		Type:        "report",
		Description: "토큰 검증 리포트 (자동 생성)",
	})

	return nil
}