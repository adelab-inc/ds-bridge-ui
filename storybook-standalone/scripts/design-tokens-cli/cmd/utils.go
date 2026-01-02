package cmd

import (
	"fmt"
	"os"
	"path/filepath"
)

// expandAndValidateFiles expands file globs and validates that files exist.
func expandAndValidateFiles(patterns []string) ([]string, error) {
	var files []string
	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return nil, fmt.Errorf("패턴 확장 실패 %s: %v", pattern, err)
		}
		if len(matches) == 0 {
			return nil, fmt.Errorf("파일을 찾을 수 없음: %s", pattern)
		}
		for _, match := range matches {
			if _, err := os.Stat(match); os.IsNotExist(err) {
				return nil, fmt.Errorf("파일이 존재하지 않음: %s", match)
			}
		}
		files = append(files, matches...)
	}
	return files, nil
}
