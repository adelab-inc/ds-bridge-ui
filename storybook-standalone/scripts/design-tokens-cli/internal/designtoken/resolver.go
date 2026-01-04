package designtoken

import (
	"fmt"
)

// AliasResolver helps resolve token aliases within a collection.
type AliasResolver struct {
	variables map[string]*DesignTokenVariable
}

// NewAliasResolver creates a new AliasResolver.
func NewAliasResolver(collection *DesignTokenCollection) *AliasResolver {
	resolver := &AliasResolver{
		variables: make(map[string]*DesignTokenVariable),
	}
	for i := range collection.Variables {
		variable := &collection.Variables[i]
		resolver.variables[variable.ID] = variable
	}
	return resolver
}

// ResolveValue resolves the final value of a variable, chasing aliases.
func (r *AliasResolver) ResolveValue(variable *DesignTokenVariable) (interface{}, error) {
	// Use the first mode's value
	for _, value := range variable.ValuesByMode {
		if aliasMap, ok := value.(map[string]interface{}); ok {
			if typeStr, ok := aliasMap["type"].(string); ok && typeStr == "VARIABLE_ALIAS" {
				if idStr, ok := aliasMap["id"].(string); ok {
					if aliasedVar, found := r.variables[idStr]; found {
						return r.ResolveValue(aliasedVar)
					}
					return nil, fmt.Errorf("alias ID not found: %s", idStr)
				}
			}
		}
		// Not an alias, return the direct value
		if colorMap, ok := value.(map[string]interface{}); ok {
			if rVal, rExists := colorMap["r"]; rExists {
				if gVal, gExists := colorMap["g"]; gExists {
					if bVal, bExists := colorMap["b"]; bExists {
						r := int(rVal.(float64) * 255)
						g := int(gVal.(float64) * 255)
						b := int(bVal.(float64) * 255)
						
						// Check for alpha value
						if aVal, aExists := colorMap["a"]; aExists {
							a := aVal.(float64)
							if a < 1.0 {
								return fmt.Sprintf("rgba(%d, %d, %d, %.2f)", r, g, b, a), nil
							}
						}
						return fmt.Sprintf("#%02x%02x%02x", r, g, b), nil
					}
				}
			}
		}
		return value, nil
	}
	return nil, fmt.Errorf("no value found for variable %s", variable.Name)
}

// FindAlias finds the variable that the given variable is aliasing.
func (r *AliasResolver) FindAlias(variable *DesignTokenVariable) (*DesignTokenVariable, error) {
	for _, value := range variable.ValuesByMode {
		if aliasMap, ok := value.(map[string]interface{}); ok {
			if typeStr, ok := aliasMap["type"].(string); ok && typeStr == "VARIABLE_ALIAS" {
				if idStr, ok := aliasMap["id"].(string); ok {
					if aliasedVar, found := r.variables[idStr]; found {
						return aliasedVar, nil
					}
					return nil, fmt.Errorf("alias ID not found: %s", idStr)
				}
			}
		}
	}
	return nil, nil // Not an alias
}

// FindFinalAlias recursively finds the final variable in an alias chain.
func (r *AliasResolver) FindFinalAlias(variable *DesignTokenVariable) (*DesignTokenVariable, error) {
	alias, err := r.FindAlias(variable)
	if err != nil {
		return nil, err
	}
	if alias == nil {
		// This variable is not an alias, so it's the end of the chain.
		return variable, nil
	}
	// This variable is an alias, so recurse.
	return r.FindFinalAlias(alias)
}