// Package designtoken provides CVA-based React component generation from Figma Design Tokens
package designtoken

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// RelationshipAnalyzer performs analysis on token relationships.
type RelationshipAnalyzer struct {
	// Regex to extract token names from a Tailwind class string.
	// It captures the token name from prefixes like bg-, text-, border-, etc.
	tokenExtractionRegex *regexp.Regexp
}

// RelationshipAnalysisResult holds the results of the token analysis.
type RelationshipAnalysisResult struct {
	DanglingReferences []string
	UnusedTokens       []string
}

// NewRelationshipAnalyzer creates a new RelationshipAnalyzer.
func NewRelationshipAnalyzer() *RelationshipAnalyzer {
	// This regex is designed to avoid capturing arbitrary values like `[#123]`
	return &RelationshipAnalyzer{
		tokenExtractionRegex: regexp.MustCompile(`(?:bg|text|border|ring|ring-offset|font|h|w|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-([a-zA-Z0-9-]+(?:/[a-zA-Z0-9-]+)*)`),
	}
}

// ... (생략) ...

// Analyze performs the token relationship analysis.
func (a *RelationshipAnalyzer) Analyze(componentDefsPath string, definedTokens map[string]bool) (*RelationshipAnalysisResult, error) {
	usedTokens, err := a.extractUsedTokensFromDefs(componentDefsPath)
	if err != nil {
		return nil, fmt.Errorf("could not extract used tokens: %w", err)
	}

	result := &RelationshipAnalysisResult{
		DanglingReferences: []string{},
		UnusedTokens:       []string{},
	}

	// List of Tailwind's default keywords to ignore
	tailwindDefaults := map[string]bool{
		"transparent": true, "current": true, "black": true, "white": true,
		"sm": true, "md": true, "lg": true, "xl": true, "2xl": true,
		"full": true, "auto": true, "screen": true, "inset": true,
	}

	// Find dangling references (used but not defined)
	for token := range usedTokens {
		// Check if the token exists as is
		if _, exists := definedTokens[token]; exists {
			continue
		}

		// Special check for typography tokens: if a token from a `text-` class is not found,
		// try prepending `typography-` to it.
		// This handles cases where `text-button-lg-medium` uses the `typography-button-lg-medium` token.
		isTypographyToken := false
		if _, isUsedInTextClass := usedTokens["text-"+token]; isUsedInTextClass || true { // A bit of a heuristic check
			typographyPrefixedToken := "typography-" + token
			if _, typographyExists := definedTokens[typographyPrefixedToken]; typographyExists {
				isTypographyToken = true
			}
		}

		if isTypographyToken {
			continue
		}

		// Ignore pure numeric tokens and default Tailwind keywords
		isNumeric, _ := regexp.MatchString("^[0-9]+$", token)
		if _, isDefault := tailwindDefaults[token]; !isDefault && !isNumeric {
			result.DanglingReferences = append(result.DanglingReferences, token)
		}
	}

	// Find unused tokens (defined but not used)
	for token := range definedTokens {
		if _, exists := usedTokens[token]; !exists {
			result.UnusedTokens = append(result.UnusedTokens, token)
		}
	}

	return result, nil
}

// extractUsedTokensFromDefs parses component-definitions.json to find all used token names.
func (a *RelationshipAnalyzer) extractUsedTokensFromDefs(defsPath string) (map[string]bool, error) {
	bytes, err := os.ReadFile(defsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read component-definitions.json: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return nil, fmt.Errorf("failed to parse component-definitions.json: %w", err)
	}

	usedTokens := make(map[string]bool)

	var extract func(v interface{})
	extract = func(v interface{}) {
		switch val := v.(type) {
		case string:
			// Split by space for multiple classes
			parts := strings.Fields(val)
			for _, part := range parts {
				// Find all matches for tokens with prefixes
				matches := a.tokenExtractionRegex.FindAllStringSubmatch(part, -1)
				for _, match := range matches {
					if len(match) > 1 {
						usedTokens[match[1]] = true
					}
				}
			}
		case map[string]interface{}:
			for _, subVal := range val {
				extract(subVal)
			}
		case []interface{}:
			for _, item := range val {
				extract(item)
			}
		}
	}

	extract(data)
	return usedTokens, nil
}
