// Package designtoken provides types and utilities for analyzing Figma Design Tokens
package designtoken

// DesignTokenCollection represents a Figma design token collection
type DesignTokenCollection struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Modes       map[string]string      `json:"modes"`
	VariableIDs []string               `json:"variableIds"`
	Variables   []DesignTokenVariable  `json:"variables"`
}

// DesignTokenVariable represents a single design token variable
type DesignTokenVariable struct {
	ID                   string                 `json:"id"`
	Name                 string                 `json:"name"`
	Description          string                 `json:"description"`
	Type                 string                 `json:"type"`
	ValuesByMode         map[string]interface{} `json:"valuesByMode"`
	ResolvedValuesByMode map[string]ResolvedValue `json:"resolvedValuesByMode"`
	Scopes               []string               `json:"scopes"`
	HiddenFromPublishing bool                   `json:"hiddenFromPublishing"`
	CodeSyntax           map[string]interface{} `json:"codeSyntax"`
}

// ResolvedValue represents a resolved value with optional alias information
type ResolvedValue struct {
	ResolvedValue interface{} `json:"resolvedValue"`
	Alias         *string     `json:"alias"` // null in JSON becomes nil in Go
	AliasName     *string     `json:"aliasName,omitempty"`
}

// ValidationError represents a validation error or warning
type ValidationError struct {
	Path    string `json:"path"`
	Message string `json:"message"`
	Level   string `json:"level"` // "error" or "warning"
}

// PatternInfo 네이밍 패턴 정보
type PatternInfo struct {
	Count    int      `json:"count"`
	Examples []string `json:"examples"`
}

// ModeInfo 모드 분석 정보
type ModeInfo struct {
	ModeCount int               `json:"mode_count"`
	Modes     map[string]string `json:"modes"`
}

// AnalysisResult represents the comprehensive analysis result of design tokens
type AnalysisResult struct {
	CollectionName    string                 `json:"collection_name"`
	IsValid           bool                   `json:"is_valid"`
	VariableCount     int                    `json:"variable_count"`
	TypeDistribution  map[string]int         `json:"type_distribution"`
	NamingPatterns    map[string]PatternInfo `json:"naming_patterns"`
	ModeAnalysis      ModeInfo               `json:"mode_analysis"`
	ValidationErrors  []ValidationError      `json:"validation_errors"`
	LoadError         *string                `json:"load_error,omitempty"`
	Recommendations   []string               `json:"recommendations"`
	AnalyzedAt        string                 `json:"analyzed_at"`
}

// SummaryStats 전체 분석 요약 통계
type SummaryStats struct {
	TotalFiles      int     `json:"total_files"`
	ValidFiles      int     `json:"valid_files"`
	TotalTokens     int     `json:"total_tokens"`
	TotalErrors     int     `json:"total_errors"`
	TotalWarnings   int     `json:"total_warnings"`
	SuccessRate     float64 `json:"success_rate"`
	AnalyzedAt      string  `json:"analyzed_at"`
}

// BatchAnalysisResult 다중 파일 분석 결과
type BatchAnalysisResult struct {
	Results []AnalysisResult `json:"results"`
	Summary SummaryStats     `json:"summary"`
}