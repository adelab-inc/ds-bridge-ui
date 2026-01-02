package designtoken

// ValidationResult holds the results of a validation check.
type ValidationResult struct {
	IsValid bool
	Errors  []ValidationError
}

// DesignTokenValidator validates a DesignTokenCollection.
type DesignTokenValidator struct{}

// NewDesignTokenValidator creates a new DesignTokenValidator.
func NewDesignTokenValidator() *DesignTokenValidator {
	return &DesignTokenValidator{}
}

// Validate performs validation on a DesignTokenCollection.
func (v *DesignTokenValidator) Validate(collection DesignTokenCollection) ValidationResult {
	var errors []ValidationError

	if collection.Name == "" {
		errors = append(errors, ValidationError{
			Path:    "name",
			Message: "Collection name is missing.",
			Level:   "error",
		})
	}

	for i, variable := range collection.Variables {
		if variable.Name == "" {
			errors = append(errors, ValidationError{
				Path:    "variables[" + string(i) + "].name",
				Message: "Variable name is missing.",
				Level:   "error",
			})
		}
	}

	return ValidationResult{
		IsValid: len(errors) == 0,
		Errors:  errors,
	}
}
