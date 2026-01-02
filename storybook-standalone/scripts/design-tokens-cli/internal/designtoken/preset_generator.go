// Package designtoken provides preset generator for TailwindCSS
package designtoken

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// PresetGenerator is responsible for generating tailwind.preset.js
type PresetGenerator struct {
	cvaGen *CVAGenerator
}

// NewPresetGenerator creates a new PresetGenerator
func NewPresetGenerator(cvaGen *CVAGenerator) *PresetGenerator {
	return &PresetGenerator{
		cvaGen: cvaGen,
	}
}

// Generate creates the tailwind.preset.js file in the project root
func (pg *PresetGenerator) Generate(outputDir string, result *CVAGenerationResult) error {
	designTokens, _ := pg.cvaGen.extractDesignTokens()
	presetPath := filepath.Join(outputDir, "tailwind.preset.js")

	var content strings.Builder

	content.WriteString("/** @type {import('tailwindcss').Config} */\n")
	content.WriteString("//  디자인 토큰 기반 TailwindCSS 프리셋\n")
	content.WriteString("// design-tokens-cli에 의해 자동 생성된 파일입니다. 직접 수정하지 마세요.\n\n")
	content.WriteString("module.exports = {\n")
	content.WriteString("  theme: {\n")
	content.WriteString("    extend: {\n")

	// Add extended theme properties
	if fontSize, exists := designTokens["fontSize"]; exists && len(fontSize) > 0 {
		content.WriteString("      fontSize: {\n")
		pg.writeTailwindConfigObject(fontSize, &content, 8)
		content.WriteString("      },\n")
	}

	if colors, exists := designTokens["colors"]; exists && len(colors) > 0 {
		content.WriteString("      colors: {\n")
		pg.writeTailwindConfigObject(colors, &content, 8)
		content.WriteString("      },\n")
	}

	if spacing, exists := designTokens["spacing"]; exists && len(spacing) > 0 {
		content.WriteString("      spacing: {\n")
		pg.writeTailwindConfigObject(spacing, &content, 8)
		content.WriteString("      },\n")
	}

	if fontWeight, exists := designTokens["fontWeight"]; exists && len(fontWeight) > 0 {
		content.WriteString("      fontWeight: {\n")
		pg.writeTailwindConfigObject(fontWeight, &content, 8)
		content.WriteString("      },\n")
	}
	
	if fontFamily, exists := designTokens["fontFamily"]; exists && len(fontFamily) > 0 {
		content.WriteString("      fontFamily: {\n")
		pg.writeTailwindConfigObject(fontFamily, &content, 8)
		content.WriteString("      },\n")
	}

	content.WriteString("    },\n")
	content.WriteString("  },\n")
	content.WriteString("  plugins: [\n")
	content.WriteString("    require('tailwindcss/plugin')(function({ addUtilities }) {\n")
	content.WriteString("      const newUtilities = {\n")
	if typography, exists := designTokens["fontSize"]; exists && len(typography) > 0 {
		keys := make([]string, 0, len(typography))
		for k := range typography {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, key := range keys {
			value := typography[key]
			if val, ok := value.([]interface{}); ok && len(val) == 2 {
				if size, sizeOk := val[0].(string); sizeOk {
					if options, ok := val[1].(map[string]interface{}); ok {
						if lineHeight, lhOk := options["lineHeight"].(string); lhOk {
							tailwindKey := strings.TrimPrefix(key, "typography-")
							className := fmt.Sprintf(".text-%s", tailwindKey)
							fontWeight := designTokens["fontWeight"][key]
							content.WriteString(fmt.Sprintf("        '%s': {\n", className))
							content.WriteString(fmt.Sprintf("          fontSize: '%s',\n", size))
							content.WriteString(fmt.Sprintf("          lineHeight: '%s',\n", lineHeight))
							content.WriteString(fmt.Sprintf("          fontWeight: '%v',\n", fontWeight))
							content.WriteString("        },\n")
						}
					}
				}
			}
		}
	}
	content.WriteString("      };\n")
	content.WriteString("      addUtilities(newUtilities);\n")
	content.WriteString("    })\n")
	content.WriteString("  ],\n")
	content.WriteString("};\n")

	if err := os.WriteFile(presetPath, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("tailwind.preset.js 파일 쓰기 실패: %v", err)
	}

	result.GeneratedFiles = append(result.GeneratedFiles, GeneratedFile{
		Path:        presetPath,
		Type:        "preset",
		Description: "중앙 TailwindCSS 프리셋 파일",
	})

	return nil
}

// writeTailwindConfigObject writes a map to Tailwind config format
func (pg *PresetGenerator) writeTailwindConfigObject(obj map[string]interface{}, builder *strings.Builder, indent int) {
	keys := make([]string, 0, len(obj))
	for key := range obj {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	indentStr := strings.Repeat(" ", indent)

	for i, key := range keys {
		builder.WriteString(fmt.Sprintf("%s'%s': ", indentStr, key))

		switch value := obj[key].(type) {
		case string:
			builder.WriteString(fmt.Sprintf("'%s'", value))
		case int:
			builder.WriteString(fmt.Sprintf("%d", value))
		case []string:
			builder.WriteString("[")
			for j, item := range value {
				builder.WriteString(fmt.Sprintf("'%s'", item))
				if j < len(value)-1 {
					builder.WriteString(", ")
				}
			}
			builder.WriteString("]")
		case []interface{}:
			builder.WriteString("[")
			for j, item := range value {
				switch typedItem := item.(type) {
				case string:
					builder.WriteString(fmt.Sprintf("'%s'", typedItem))
				case map[string]interface{}:
					builder.WriteString("{ ")
					for prop, val := range typedItem {
						builder.WriteString(fmt.Sprintf("%s: '%v' ", prop, val))
					}
					builder.WriteString("}")
				}
				if j < len(value)-1 {
					builder.WriteString(", ")
				}
			}
			builder.WriteString("]")
		default:
			builder.WriteString("null")
		}

		if i < len(keys)-1 {
			builder.WriteString(",")
		}
		builder.WriteString("\n")
	}
}
