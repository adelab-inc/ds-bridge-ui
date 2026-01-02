package designtoken

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAnalyzer_AnalyzeFile_ValidTypographyToken 유효한 Typography 토큰 파일 분석 테스트
func TestAnalyzer_AnalyzeFile_ValidTypographyToken(t *testing.T) {
	// Python: test_analyze_file 기능 포팅
	analyzer := NewAnalyzer()
	
	// Typography 토큰 테스트 데이터
	typographyData := DesignTokenCollection{
		ID:   "VariableCollectionId:4:287",
		Name: "typography",
		Modes: map[string]string{
			"4:3": "Mode 1",
		},
		Variables: []DesignTokenVariable{
			{
				ID:          "VariableID:4:288",
				Name:        "font/size/heading/xl",
				Type:        "FLOAT",
				ValuesByMode: map[string]interface{}{"4:3": 28},
				ResolvedValuesByMode: map[string]ResolvedValue{
					"4:3": {ResolvedValue: 28, Alias: nil},
				},
				Scopes:               []string{"FONT_SIZE"},
				HiddenFromPublishing: false,
			},
			{
				ID:          "VariableID:4:295",
				Name:        "font/weight/regular",
				Type:        "STRING",
				ValuesByMode: map[string]interface{}{"4:3": "Regular"},
				ResolvedValuesByMode: map[string]ResolvedValue{
					"4:3": {ResolvedValue: "Regular", Alias: nil},
				},
				Scopes:               []string{"FONT_STYLE"},
				HiddenFromPublishing: false,
			},
		},
	}
	
	tempFile := createTempTokenFile(t, typographyData)
	defer os.Remove(tempFile)
	
	result := analyzer.AnalyzeFile(tempFile)
	
	// 기본 검증
	assert.True(t, result.IsValid)
	assert.Equal(t, "typography", result.CollectionName)
	assert.Equal(t, 2, result.VariableCount)
	assert.Nil(t, result.LoadError)
	
	// 타입 분포 검증
	assert.Equal(t, 1, result.TypeDistribution["FLOAT"])
	assert.Equal(t, 1, result.TypeDistribution["STRING"])
	
	// 네이밍 패턴 검증
	fontPattern, exists := result.NamingPatterns["font"]
	assert.True(t, exists)
	assert.Equal(t, 2, fontPattern.Count)
	assert.Contains(t, fontPattern.Examples, "font/size/heading/xl")
	assert.Contains(t, fontPattern.Examples, "font/weight/regular")
	
	// 모드 분석 검증
	assert.Equal(t, 1, result.ModeAnalysis.ModeCount)
	assert.Equal(t, "Mode 1", result.ModeAnalysis.Modes["4:3"])
	
	// 권장사항 검증
	assert.Greater(t, len(result.Recommendations), 0)
	
	// 시간 필드 검증
	assert.NotEmpty(t, result.AnalyzedAt)
}

// TestAnalyzer_AnalyzeFile_InvalidFile 잘못된 파일 분석 테스트
func TestAnalyzer_AnalyzeFile_InvalidFile(t *testing.T) {
	// Python: test_analyze_file_with_load_error 포팅
	analyzer := NewAnalyzer()
	
	result := analyzer.AnalyzeFile("/nonexistent/file.json")
	
	assert.False(t, result.IsValid)
	assert.Equal(t, "unknown", result.CollectionName)
	assert.Equal(t, 0, result.VariableCount)
	assert.NotNil(t, result.LoadError)
	assert.Contains(t, *result.LoadError, "File not found")
}

// TestAnalyzer_AnalyzeFile_EmptyFile 빈 파일 분석 테스트
func TestAnalyzer_AnalyzeFile_EmptyFile(t *testing.T) {
	analyzer := NewAnalyzer()
	
	// 빈 파일 생성
	tempFile, err := ioutil.TempFile("", "empty_*.json")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())
	tempFile.Close()
	
	result := analyzer.AnalyzeFile(tempFile.Name())
	
	assert.False(t, result.IsValid)
	assert.NotNil(t, result.LoadError)
	assert.Contains(t, *result.LoadError, "Empty file")
}

// TestAnalyzer_AnalyzeFiles_MultipleFiles 다중 파일 분석 테스트
func TestAnalyzer_AnalyzeFiles_MultipleFiles(t *testing.T) {
	// Python: test_analyze_files 포팅
	analyzer := NewAnalyzer()
	
	// Typography 파일
	typographyData := DesignTokenCollection{
		ID:   "VariableCollectionId:1:1",
		Name: "typography",
		Modes: map[string]string{"mode": "Mode 1"},
		Variables: []DesignTokenVariable{
			{
				ID:          "VariableID:1:1",
				Name:        "font/size/xl",
				Type:        "FLOAT",
				ValuesByMode: map[string]interface{}{"mode": 24},
				ResolvedValuesByMode: map[string]ResolvedValue{
					"mode": {ResolvedValue: 24, Alias: nil},
				},
				Scopes: []string{"FONT_SIZE"},
			},
		},
	}
	
	// Space 파일
	spaceData := DesignTokenCollection{
		ID:   "VariableCollectionId:2:2",
		Name: "space",
		Modes: map[string]string{"mode": "Mode 1"},
		Variables: []DesignTokenVariable{
			{
				ID:          "VariableID:2:1",
				Name:        "space/scale/4",
				Type:        "FLOAT",
				ValuesByMode: map[string]interface{}{"mode": 16},
				ResolvedValuesByMode: map[string]ResolvedValue{
					"mode": {ResolvedValue: 16, Alias: nil},
				},
				Scopes: []string{"ALL_SCOPES"},
			},
			{
				ID:          "VariableID:2:2",
				Name:        "space/scale/8",
				Type:        "FLOAT",
				ValuesByMode: map[string]interface{}{"mode": 32},
				ResolvedValuesByMode: map[string]ResolvedValue{
					"mode": {ResolvedValue: 32, Alias: nil},
				},
				Scopes: []string{"ALL_SCOPES"},
			},
		},
	}
	
	typographyFile := createTempTokenFile(t, typographyData)
	spaceFile := createTempTokenFile(t, spaceData)
	defer func() {
		os.Remove(typographyFile)
		os.Remove(spaceFile)
	}()
	
	batchResult := analyzer.AnalyzeFiles([]string{typographyFile, spaceFile})
	
	// 배치 결과 검증
	assert.Equal(t, 2, len(batchResult.Results))
	assert.Equal(t, 2, batchResult.Summary.TotalFiles)
	assert.Equal(t, 2, batchResult.Summary.ValidFiles)
	assert.Equal(t, 3, batchResult.Summary.TotalTokens) // 1 + 2 = 3
	assert.Equal(t, 100.0, batchResult.Summary.SuccessRate)
	
	// 개별 결과 검증
	assert.Equal(t, "typography", batchResult.Results[0].CollectionName)
	assert.Equal(t, "space", batchResult.Results[1].CollectionName)
	assert.Equal(t, 1, batchResult.Results[0].VariableCount)
	assert.Equal(t, 2, batchResult.Results[1].VariableCount)
}

// TestAnalyzer_AnalyzeTypeDistribution 타입 분포 분석 테스트
func TestAnalyzer_AnalyzeTypeDistribution(t *testing.T) {
	analyzer := NewAnalyzer()
	
	variables := []DesignTokenVariable{
		{Type: "FLOAT", Name: "test1"},
		{Type: "FLOAT", Name: "test2"},
		{Type: "STRING", Name: "test3"},
		{Type: "COLOR", Name: "test4"},
		{Type: "COLOR", Name: "test5"},
		{Type: "COLOR", Name: "test6"},
	}
	
	distribution := analyzer.analyzeTypeDistribution(variables)
	
	assert.Equal(t, 2, distribution["FLOAT"])
	assert.Equal(t, 1, distribution["STRING"])
	assert.Equal(t, 3, distribution["COLOR"])
}

// TestAnalyzer_AnalyzeNamingPatterns 네이밍 패턴 분석 테스트
func TestAnalyzer_AnalyzeNamingPatterns(t *testing.T) {
	analyzer := NewAnalyzer()
	
	variables := []DesignTokenVariable{
		{Name: "font/size/xl"},
		{Name: "font/size/lg"},
		{Name: "font/weight/bold"},
		{Name: "color/primary/500"},
		{Name: "color/secondary/300"},
		{Name: "space/scale/4"},
	}
	
	patterns := analyzer.analyzeNamingPatterns(variables)
	
	// 패턴 카운트 검증
	assert.Equal(t, 3, patterns["font"].Count)
	assert.Equal(t, 2, patterns["color"].Count)
	assert.Equal(t, 1, patterns["space"].Count)
	
	// 예시 검증
	assert.Contains(t, patterns["font"].Examples, "font/size/xl")
	assert.Contains(t, patterns["color"].Examples, "color/primary/500")
	assert.Contains(t, patterns["space"].Examples, "space/scale/4")
}

// TestAnalyzer_GenerateRecommendations 권장사항 생성 테스트
func TestAnalyzer_GenerateRecommendations(t *testing.T) {
	analyzer := NewAnalyzer()
	
	// 토큰 수가 적은 경우 테스트
	result := &AnalysisResult{
		VariableCount:    5,
		ValidationErrors: []ValidationError{},
		NamingPatterns:   map[string]PatternInfo{"font": {Count: 5}},
		ModeAnalysis:     ModeInfo{ModeCount: 0},
	}
	
	recommendations := analyzer.generateRecommendations(result)
	
	assert.Greater(t, len(recommendations), 0)
	assert.Contains(t, strings.Join(recommendations, " "), "토큰 수가 적습니다")
	assert.Contains(t, strings.Join(recommendations, " "), "다양한 모드 지원을")
	assert.Contains(t, strings.Join(recommendations, " "), "다양한 토큰 카테고리를")
}

// TestAnalyzer_DetectCollectionType 컬렉션 타입 감지 테스트
func TestAnalyzer_DetectCollectionType(t *testing.T) {
	analyzer := NewAnalyzer()
	
	testCases := []struct {
		name      string
		variables []DesignTokenVariable
		expected  string
	}{
		{
			name: "typography",
			variables: []DesignTokenVariable{
				{Name: "font/size/xl"},
				{Name: "font/weight/bold"},
			},
			expected: "typography",
		},
		{
			name: "unknown",
			variables: []DesignTokenVariable{
				{Name: "color/primary/500"},
				{Name: "color/secondary/300"},
			},
			expected: "colors",
		},
		{
			name: "spacing",
			variables: []DesignTokenVariable{
				{Name: "space/scale/4"},
				{Name: "space/inset/md"},
			},
			expected: "spacing",
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := analyzer.DetectCollectionType(tc.name, tc.variables)
			assert.Equal(t, tc.expected, result)
		})
	}
}

// TestAnalyzer_AnalyzeModes 모드 분석 테스트
func TestAnalyzer_AnalyzeModes(t *testing.T) {
	analyzer := NewAnalyzer()
	
	collection := &DesignTokenCollection{
		Modes: map[string]string{
			"light": "Light Mode",
			"dark":  "Dark Mode",
		},
	}
	
	modeInfo := analyzer.analyzeModes(collection)
	
	assert.Equal(t, 2, modeInfo.ModeCount)
	assert.Equal(t, "Light Mode", modeInfo.Modes["light"])
	assert.Equal(t, "Dark Mode", modeInfo.Modes["dark"])
}

// Helper 함수: 임시 토큰 파일 생성
func createTempTokenFile(t *testing.T, data DesignTokenCollection) string {
	tempDir := os.TempDir()
	
	file, err := ioutil.TempFile(tempDir, "test_token_*.json")
	require.NoError(t, err)
	defer file.Close()
	
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)
	
	_, err = file.Write(jsonData)
	require.NoError(t, err)
	
	return file.Name()
}

// Benchmark: 대용량 토큰 파일 처리 성능 테스트
func BenchmarkAnalyzer_AnalyzeFile_LargeFile(b *testing.B) {
	analyzer := NewAnalyzer()
	
	// 1000개 토큰이 포함된 큰 파일 생성
	variables := make([]DesignTokenVariable, 1000)
	for i := 0; i < 1000; i++ {
		variables[i] = DesignTokenVariable{
			Name: fmt.Sprintf("font/size/test%d", i),
			Type: "FLOAT",
			ValuesByMode: map[string]interface{}{"mode": i + 10},
		}
	}
	
	largeData := DesignTokenCollection{
		Name:      "large-collection",
		Variables: variables,
	}
	
	tempFile, err := ioutil.TempFile("", "large_token_*.json")
	require.NoError(b, err)
	defer os.Remove(tempFile.Name())
	
	jsonData, err := json.Marshal(largeData)
	require.NoError(b, err)
	
	err = ioutil.WriteFile(tempFile.Name(), jsonData, 0644)
	require.NoError(b, err)
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		result := analyzer.AnalyzeFile(tempFile.Name())
		_ = result // 사용하지 않는 변수 경고 방지
	}
}