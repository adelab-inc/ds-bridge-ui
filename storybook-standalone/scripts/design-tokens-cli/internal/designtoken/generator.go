package designtoken

import (
	"fmt"
	"strings"
)

// GenerateColorTokens takes a DesignTokenCollection and returns the
// TypeScript code for color tokens (palette and role).
func GenerateColorTokens(collection *DesignTokenCollection) (string, error) {
	var paletteBuilder, roleBuilder strings.Builder

	paletteBuilder.WriteString("export const palette = {\n")
	roleBuilder.WriteString("export const role = {\n")

	aliasResolver := NewAliasResolver(collection)

	for _, variable := range collection.Variables {
		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 3 {
			continue
		}
		tokenType := nameParts[1]
		tokenName := strings.Join(nameParts[2:], "-")

		if tokenType == "palette" {
			resolvedValue, err := aliasResolver.ResolveValue(&variable)
			if err != nil {
				return "", fmt.Errorf("palette 토큰 값 확인 실패 %s: %w", variable.Name, err)
			}
			if colorVal, ok := resolvedValue.(string); ok {
				paletteBuilder.WriteString(fmt.Sprintf("  '%s': '%s',\n", tokenName, colorVal))
			}
		} else if tokenType == "role" {
			finalAlias, err := aliasResolver.FindFinalAlias(&variable)
			if err != nil || finalAlias == nil {
				continue
			}

			aliasParts := strings.Split(finalAlias.Name, "/")
			if len(aliasParts) < 3 || aliasParts[1] != "palette" {
				continue
			}
			
			aliasPaletteName := strings.Join(aliasParts[2:], "-")
			refValue := fmt.Sprintf("palette['%s']", aliasPaletteName)
			roleBuilder.WriteString(fmt.Sprintf("  '%s': %s,\n", tokenName, refValue))
		}
	}

	paletteBuilder.WriteString("} as const;\n\n")
	roleBuilder.WriteString("} as const;\n")

	return paletteBuilder.String() + roleBuilder.String(), nil
}

// GenerateSpaceTokens takes a DesignTokenCollection and returns the
// TypeScript code for space tokens.
func GenerateSpaceTokens(collection *DesignTokenCollection) (string, error) {
	var builder strings.Builder
	builder.WriteString("export const space = {\n")

	for _, variable := range collection.Variables {
		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 2 {
			continue
		}
		tokenName := strings.Join(nameParts[1:], "-")
		
		// For space, we take the first mode's value directly.
		for _, value := range variable.ValuesByMode {
			if floatVal, ok := value.(float64); ok {
				builder.WriteString(fmt.Sprintf("  '%s': '%dpx',\n", tokenName, int(floatVal)))
			}
			break // Only use the first mode
		}
	}

	builder.WriteString("} as const;\n")
	return builder.String(), nil
}

// GenerateTypographyTokens takes a DesignTokenCollection and returns the
// TypeScript code for typography tokens.
func GenerateTypographyTokens(collection *DesignTokenCollection) (string, error) {
	var builder strings.Builder
	builder.WriteString("export const typography = {\n")

	for _, variable := range collection.Variables {
		if variable.Type != "TYPOGRAPHY" {
			continue
		}

		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 2 {
			continue
		}
		tokenName := strings.Join(nameParts, "-")

		for _, value := range variable.ValuesByMode {
			// The value is a map[string]interface{}, where the key is a mode ID
			// and the value is another map representing the typography properties.
			if typographyMap, ok := value.(map[string]interface{}); ok {
				builder.WriteString(fmt.Sprintf("  '%s': {\n", tokenName))
				builder.WriteString(fmt.Sprintf("    fontFamily: '%s',\n", typographyMap["fontFamily"]))
				builder.WriteString(fmt.Sprintf("    fontWeight: '%s',\n", typographyMap["fontWeight"]))
				builder.WriteString(fmt.Sprintf("    fontSize: '%s',\n", typographyMap["fontSize"]))
				builder.WriteString(fmt.Sprintf("    lineHeight: '%s',\n", typographyMap["lineHeight"]))
				builder.WriteString("  },\n")
			}
			break // Only use the first mode
		}
	}

	builder.WriteString("} as const;\n")
	return builder.String(), nil
}

// GenerateColorTokensForFlat takes a DesignTokenCollection and returns the
// TypeScript code snippet for the 'colors' property in design-tokens.ts.
func GenerateColorTokensForFlat(collection *DesignTokenCollection) (string, error) {
	var builder strings.Builder
	builder.WriteString("  colors: {\n")

	aliasResolver := NewAliasResolver(collection)

	for _, variable := range collection.Variables {
		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 3 {
			continue
		}
		tokenType := nameParts[1]
		tokenName := strings.Join(nameParts[2:], "-")

		if tokenType == "role" {
			resolvedValue, err := aliasResolver.ResolveValue(&variable)
			if err != nil {
				return "", fmt.Errorf("role 토큰 값 확인 실패 %s: %w", variable.Name, err)
			}
			if colorVal, ok := resolvedValue.(string); ok {
				builder.WriteString(fmt.Sprintf("    '%s': '%s',\n", tokenName, colorVal))
			}
		}
	}

	builder.WriteString("  },\n")
	return builder.String(), nil
}

// GenerateSpaceTokensForFlat takes a DesignTokenCollection and returns the
// TypeScript code snippet for the 'spacing' property in design-tokens.ts.
func GenerateSpaceTokensForFlat(collection *DesignTokenCollection) (string, error) {
	var builder strings.Builder
	builder.WriteString("  spacing: {\n")

	for _, variable := range collection.Variables {
		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 2 {
			continue
		}
		tokenName := strings.Join(nameParts[1:], "-")
		
		for _, value := range variable.ValuesByMode {
			if floatVal, ok := value.(float64); ok {
				builder.WriteString(fmt.Sprintf("    '%s': '%dpx',\n", tokenName, int(floatVal)))
			}
			break 
		}
	}

	builder.WriteString("  },\n")
	return builder.String(), nil
}

// GenerateTypographyTokensForFlat takes a DesignTokenCollection and returns the
// TypeScript code snippet for typography properties in design-tokens.ts.
func GenerateTypographyTokensForFlat(collection *DesignTokenCollection) (string, error) {
	var fontSizeBuilder, fontWeightBuilder, fontFamilyBuilder strings.Builder
	fontSizeBuilder.WriteString("  fontSize: {\n")
	fontWeightBuilder.WriteString("  fontWeight: {\n")
	fontFamilyBuilder.WriteString("  fontFamily: {\n")

	for _, variable := range collection.Variables {
		nameParts := strings.Split(variable.Name, "/")
		if len(nameParts) < 3 {
			continue
		}
		category := nameParts[1]
		tokenName := strings.Join(nameParts[2:], "-")

		for _, value := range variable.ValuesByMode {
			switch category {
			case "size":
				if floatVal, ok := value.(float64); ok {
					// Simplified version for now
					fontSizeBuilder.WriteString(fmt.Sprintf("    '%s': '%dpx',\n", tokenName, int(floatVal)))
				}
			case "weight":
				if strVal, ok := value.(string); ok {
					fontWeightBuilder.WriteString(fmt.Sprintf("    '%s': '%s',\n", tokenName, strVal))
				}
			case "family":
				if strVal, ok := value.(string); ok {
					fontFamilyBuilder.WriteString(fmt.Sprintf("    '%s': '%s',\n", tokenName, strVal))
				}
			}
			break
		}
	}

	fontSizeBuilder.WriteString("  },\n")
	fontWeightBuilder.WriteString("  },\n")
	fontFamilyBuilder.WriteString("  },\n")

	return fontSizeBuilder.String() + fontWeightBuilder.String() + fontFamilyBuilder.String(), nil
}

