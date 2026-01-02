package designtoken

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGenerateDesignTokensJSONFile JSON 파일 생성 테스트
func TestGenerateDesignTokensJSONFile(t *testing.T) {
	// 임시 디렉토리 생성
	tempDir := t.TempDir()

	// tokens 하위 디렉토리 생성
	tokensDir := filepath.Join(tempDir, "tokens")
	require.NoError(t, os.MkdirAll(tokensDir, 0755))

	// CVAGenerator 인스턴스 생성
	generator := NewCVAGenerator()

	// 테스트용 토큰 데이터
	designTokens := map[string]map[string]interface{}{
		"colors": {
			"primary":   "#0033a0",
			"secondary": "#98b3ee",
		},
		"spacing": {
			"4": "16px",
			"8": "32px",
		},
	}

	mappings := []TokenMapping{
		{TailwindName: "primary", FigmaName: "color/role/primary"},
		{TailwindName: "secondary", FigmaName: "color/role/secondary"},
	}

	options := &CVAGenerationOptions{
		OutputDir: tempDir,
		Verbose:   false,
	}
	result := &CVAGenerationResult{
		GeneratedFiles: []GeneratedFile{},
	}

	// 함수 실행
	err := generator.generateDesignTokensJSONFile(options, result, designTokens, mappings)
	require.NoError(t, err)

	// 파일 존재 확인
	jsonFilePath := filepath.Join(tokensDir, "design-tokens.json")
	assert.FileExists(t, jsonFilePath)

	// 파일 내용 검증
	jsonBytes, err := os.ReadFile(jsonFilePath)
	require.NoError(t, err)

	var jsonData DesignTokensJSON
	err = json.Unmarshal(jsonBytes, &jsonData)
	require.NoError(t, err)

	// 토큰 데이터 검증
	assert.Equal(t, "#0033a0", jsonData.DesignTokens["colors"]["primary"])
	assert.Equal(t, "#98b3ee", jsonData.DesignTokens["colors"]["secondary"])
	assert.Equal(t, "16px", jsonData.DesignTokens["spacing"]["4"])

	// 매핑 검증
	assert.Equal(t, "color/role/primary", jsonData.TokenMapping["primary"])
	assert.Equal(t, "color/role/secondary", jsonData.TokenMapping["secondary"])

	// 메타데이터 검증
	assert.Equal(t, "design-tokens-cli", jsonData.Metadata.Generator)
	assert.NotEmpty(t, jsonData.Metadata.GeneratedAt)
	assert.NotEmpty(t, jsonData.Metadata.Version)

	// result에 파일 추가 확인
	assert.Len(t, result.GeneratedFiles, 1)
	assert.Equal(t, "design-tokens-json", result.GeneratedFiles[0].Type)
}

// TestGenerateDesignTokensJSONFile_EmptyTokens 빈 토큰 처리 테스트
func TestGenerateDesignTokensJSONFile_EmptyTokens(t *testing.T) {
	tempDir := t.TempDir()

	tokensDir := filepath.Join(tempDir, "tokens")
	require.NoError(t, os.MkdirAll(tokensDir, 0755))

	generator := NewCVAGenerator()

	designTokens := map[string]map[string]interface{}{}
	mappings := []TokenMapping{}

	options := &CVAGenerationOptions{OutputDir: tempDir}
	result := &CVAGenerationResult{GeneratedFiles: []GeneratedFile{}}

	err := generator.generateDesignTokensJSONFile(options, result, designTokens, mappings)
	require.NoError(t, err)

	jsonFilePath := filepath.Join(tokensDir, "design-tokens.json")
	assert.FileExists(t, jsonFilePath)

	jsonBytes, err := os.ReadFile(jsonFilePath)
	require.NoError(t, err)

	var jsonData DesignTokensJSON
	err = json.Unmarshal(jsonBytes, &jsonData)
	require.NoError(t, err)

	assert.Empty(t, jsonData.DesignTokens)
	assert.Empty(t, jsonData.TokenMapping)
	assert.NotEmpty(t, jsonData.Metadata.GeneratedAt)
}

// TestGenerateDesignTokensJSONFile_DirectoryNotExists 디렉토리 미존재 시 에러 테스트
func TestGenerateDesignTokensJSONFile_DirectoryNotExists(t *testing.T) {
	generator := NewCVAGenerator()

	designTokens := map[string]map[string]interface{}{}
	mappings := []TokenMapping{}

	options := &CVAGenerationOptions{OutputDir: "/nonexistent/path"}
	result := &CVAGenerationResult{GeneratedFiles: []GeneratedFile{}}

	err := generator.generateDesignTokensJSONFile(options, result, designTokens, mappings)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "파일 쓰기 실패")
}

// TestGenerateDesignTokensJSONFile_ComplexTokenValues 복잡한 토큰 값 테스트
func TestGenerateDesignTokensJSONFile_ComplexTokenValues(t *testing.T) {
	tempDir := t.TempDir()
	tokensDir := filepath.Join(tempDir, "tokens")
	require.NoError(t, os.MkdirAll(tokensDir, 0755))

	generator := NewCVAGenerator()

	// fontSize는 배열 형태 (["18px", {"lineHeight": "28px"}])
	designTokens := map[string]map[string]interface{}{
		"fontSize": {
			"body-lg": []interface{}{"18px", map[string]interface{}{"lineHeight": "28px"}},
			"body-sm": []interface{}{"14px", map[string]interface{}{"lineHeight": "20px"}},
		},
		"colors": {
			"primary": "#0033a0",
		},
	}

	mappings := []TokenMapping{
		{TailwindName: "body-lg", FigmaName: "typography/body/lg"},
	}

	options := &CVAGenerationOptions{OutputDir: tempDir}
	result := &CVAGenerationResult{GeneratedFiles: []GeneratedFile{}}

	err := generator.generateDesignTokensJSONFile(options, result, designTokens, mappings)
	require.NoError(t, err)

	jsonFilePath := filepath.Join(tokensDir, "design-tokens.json")
	jsonBytes, err := os.ReadFile(jsonFilePath)
	require.NoError(t, err)

	var jsonData DesignTokensJSON
	err = json.Unmarshal(jsonBytes, &jsonData)
	require.NoError(t, err)

	// 복잡한 값이 올바르게 직렬화되었는지 확인
	fontSizeValue := jsonData.DesignTokens["fontSize"]["body-lg"]
	assert.NotNil(t, fontSizeValue)

	// 배열 형태로 저장되었는지 확인
	fontSizeArray, ok := fontSizeValue.([]interface{})
	assert.True(t, ok, "fontSize value should be an array")
	assert.Len(t, fontSizeArray, 2)
}
