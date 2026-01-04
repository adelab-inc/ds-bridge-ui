package designtoken

import (
	"encoding/json"
	"os"
)

// SafeJsonLoader is a utility for safely loading and parsing JSON files.
type SafeJsonLoader struct{}

// NewSafeJsonLoader creates a new SafeJsonLoader.
func NewSafeJsonLoader() *SafeJsonLoader {
	return &SafeJsonLoader{}
}

// LoadDesignTokenCollection loads a design token collection from a JSON file.
func (l *SafeJsonLoader) LoadDesignTokenCollection(filePath string) (*DesignTokenCollection, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var collection DesignTokenCollection
	if err := json.Unmarshal(data, &collection); err != nil {
		return nil, err
	}

	return &collection, nil
}
