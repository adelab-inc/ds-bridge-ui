// Package designtoken provides types and utilities for analyzing Figma Design Tokens
package designtoken

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// Analyzer analyzes design token files.
type Analyzer struct{}

// NewAnalyzer creates a new Analyzer.
func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

// AnalyzeFiles analyzes a list of token files and returns a batch result.
func (a *Analyzer) AnalyzeFiles(files []string) *BatchAnalysisResult {
	var wg sync.WaitGroup
	resultsChan := make(chan AnalysisResult, len(files))

	for _, file := range files {
		wg.Add(1)
		go func(filename string) {
			defer wg.Done()
			resultsChan <- a.analyzeFile(filename)
		}(file)
	}

	wg.Wait()
	close(resultsChan)

	var results []AnalysisResult
	summary := SummaryStats{TotalFiles: len(files)}
	for result := range resultsChan {
		results = append(results, result)
		if result.IsValid {
			summary.ValidFiles++
		}
		summary.TotalTokens += result.VariableCount
		for _, err := range result.ValidationErrors {
			if err.Level == "error" {
				summary.TotalErrors++
			} else {
				summary.TotalWarnings++
			}
		}
	}

	if summary.TotalFiles > 0 {
		summary.SuccessRate = float64(summary.ValidFiles) / float64(summary.TotalFiles) * 100
	}
	summary.AnalyzedAt = time.Now().UTC().Format(time.RFC3339)

	return &BatchAnalysisResult{
		Results: results,
		Summary: summary,
	}
}

// analyzeFile analyzes a single token file.
func (a *Analyzer) analyzeFile(filename string) AnalysisResult {
	now := time.Now().UTC().Format(time.RFC3339)
	content, err := os.ReadFile(filename)
	if err != nil {
		errStr := err.Error()
		return AnalysisResult{LoadError: &errStr, AnalyzedAt: now}
	}

	var collection DesignTokenCollection
	if err := json.Unmarshal(content, &collection); err != nil {
		errStr := err.Error()
		return AnalysisResult{LoadError: &errStr, AnalyzedAt: now}
	}

	// This is a simplified mock analysis.
	// A real implementation would have complex validation logic here.
	result := AnalysisResult{
		CollectionName:   collection.Name,
		IsValid:          true,
		VariableCount:    len(collection.Variables),
		TypeDistribution: make(map[string]int),
		ValidationErrors: []ValidationError{},
		AnalyzedAt:       now,
	}

	for _, v := range collection.Variables {
		result.TypeDistribution[v.Type]++
	}

	return result
}