/*
Design Tokens → 분석 도구
Figma 디자인 토큰을 분석하고 검증하는 도구입니다.
*/
package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"design-tokens-cli/internal/designtoken"
)

var designTokensAnalyzeCmd = &cobra.Command{
	Use:   "analyze [input-files...]",
	Short: "Figma 디자인 토큰을 분석하고 검증",
	Long: `Figma 디자인 토큰 파일들을 분석하여 상세한 정보를 제공합니다.

🎯 주요 기능:
• 토큰 유효성 검증 및 스키마 체크
• 타입 분포 및 네이밍 패턴 분석
• 모드 분석 및 구조 검증
• 개선 권장사항 제공

📋 지원하는 분석:
  Schema: Figma 토큰 구조 검증
  Types: FLOAT, STRING, COLOR 등 타입 분포
  Naming: font/*, color/*, space/* 네이밍 패턴
  Modes: 다크모드, 컴팩트 모드 등 모드 분석

예시:
  # 단일 파일 분석
  design-tokens-cli design-tokens analyze typography.json
  
  # 다중 파일 분석
  design-tokens-cli design-tokens analyze typography.json color.json space.json
  
  # 상세 정보 포함
  design-tokens-cli design-tokens analyze --verbose *.json
  
  # JSON 형식 출력
  design-tokens-cli design-tokens analyze --json typography.json`,
	Args: cobra.MinimumNArgs(1),
	RunE: runAnalyze,
}

var (
	analyzeVerbose bool
	analyzeJSON    bool
)

func init() {
	designTokensCmd.AddCommand(designTokensAnalyzeCmd)

	// 분석기 전용 플래그
	designTokensAnalyzeCmd.Flags().BoolVarP(&analyzeVerbose, "verbose", "v", false, "상세 출력 활성화")
	designTokensAnalyzeCmd.Flags().BoolVar(&analyzeJSON, "json", false, "JSON 형식으로 출력")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	// 입력 파일 확장 및 검증
	files, err := expandAndValidateFiles(args)
	if err != nil {
		return fmt.Errorf("파일 검증 실패: %v", err)
	}

	if analyzeVerbose {
		fmt.Printf("📊 Design Token 분석기 시작\n")
		fmt.Printf("📁 처리할 파일: %v\n", files)
		fmt.Printf("🔍 상세 모드: %t\n", analyzeVerbose)
		fmt.Println()
	}

	// 분석기 생성 및 실행
	analyzer := designtoken.NewAnalyzer()
	batchResult := analyzer.AnalyzeFiles(files)

	// 결과 출력
	if analyzeJSON {
		printAnalysisResultAsJSON(batchResult)
	} else {
		printAnalysisResult(batchResult)
	}

	return nil
}

// JSON 형식 출력
func printAnalysisResultAsJSON(batchResult *designtoken.BatchAnalysisResult) {
	jsonData, err := json.MarshalIndent(batchResult, "", "  ")
	if err != nil {
		fmt.Printf("JSON 직렬화 오류: %v\n", err)
		return
	}
	fmt.Println(string(jsonData))
}

// 표 형식 출력
func printAnalysisResult(batchResult *designtoken.BatchAnalysisResult) {
	fmt.Printf("\n📊 Design Token 분석 완료\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	// 전체 요약
	summary := batchResult.Summary
	fmt.Printf("📋 전체 요약\n")
	fmt.Printf("   파일 수: %d개 (유효: %d개, 무효: %d개)\n", 
		summary.TotalFiles, summary.ValidFiles, summary.TotalFiles-summary.ValidFiles)
	fmt.Printf("   토큰 수: %d개\n", summary.TotalTokens)
	fmt.Printf("   성공률: %.1f%%\n", summary.SuccessRate)
	
	if summary.TotalErrors > 0 || summary.TotalWarnings > 0 {
		fmt.Printf("   문제점: 오류 %d개, 경고 %d개\n", summary.TotalErrors, summary.TotalWarnings)
	}
	
	fmt.Println()

	// 개별 파일 결과
	for i, result := range batchResult.Results {
		printSingleResult(&result, i+1, analyzeVerbose)
	}

	// 전체 권장사항
	if len(batchResult.Results) > 1 {
		printBatchRecommendations(batchResult)
	}
}

// 단일 파일 결과 출력
func printSingleResult(result *designtoken.AnalysisResult, index int, verbose bool) {
	status := "❌"
	if result.IsValid {
		status = "✅"
	}
	fmt.Printf("%s %d. %s\n", status, index, result.CollectionName)
	fmt.Printf("─────────────────────────────────────────────────\n")

	// 로드 오류
	if result.LoadError != nil {
		fmt.Printf("❌ 로드 오류: %s\n\n", *result.LoadError)
		return
	}

	// 기본 정보
	fmt.Printf("📊 변수 개수: %d개\n", result.VariableCount)

	// 타입 분포
	if len(result.TypeDistribution) > 0 {
		fmt.Printf("🏷️  타입 분포:\n")
		for typeName, count := range result.TypeDistribution {
			percentage := 0.0
			if result.VariableCount > 0 {
				percentage = float64(count) / float64(result.VariableCount) * 100
			}
			fmt.Printf("   • %s: %d개 (%.1f%%)\n", typeName, count, percentage)
		}
	}

	// 네이밍 패턴
	if len(result.NamingPatterns) > 0 {
		fmt.Printf("📝 네이밍 패턴:\n")
		for category, info := range result.NamingPatterns {
			examples := strings.Join(info.Examples[:min(len(info.Examples), 2)], ", ")
			fmt.Printf("   • %s: %d개 (예: %s)\n", category, info.Count, examples)
		}
	}

	// 모드 정보
	if result.ModeAnalysis.ModeCount > 0 {
		modes := make([]string, 0, len(result.ModeAnalysis.Modes))
		for _, modeName := range result.ModeAnalysis.Modes {
			modes = append(modes, modeName)
		}
		fmt.Printf("🔄 모드: %d개 (%s)\n", 
			result.ModeAnalysis.ModeCount, strings.Join(modes, ", "))
	}

	// 검증 오류 (요약)
	if len(result.ValidationErrors) > 0 {
		errorCount := 0
		warningCount := 0
		
		for _, validationError := range result.ValidationErrors {
			if validationError.Level == "error" {
				errorCount++
			} else if validationError.Level == "warning" {
				warningCount++
			}
		}

		if errorCount > 0 {
			fmt.Printf("🚨 오류: %d개\n", errorCount)
		}
		if warningCount > 0 {
			fmt.Printf("⚠️  경고: %d개\n", warningCount)
		}

		// verbose 모드에서는 상세 오류 표시
		if verbose {
			maxErrors := min(len(result.ValidationErrors), 5)
			for i := 0; i < maxErrors; i++ {
				err := result.ValidationErrors[i]
				levelIcon := "🚨"
				if err.Level == "warning" {
					levelIcon = "⚠️"
				}
				fmt.Printf("   %s %s: %s\n", levelIcon, err.Path, err.Message)
			}
			
			if len(result.ValidationErrors) > 5 {
				fmt.Printf("   ... 그 외 %d개\n", len(result.ValidationErrors)-5)
			}
		}
	}

	// 권장사항
	if len(result.Recommendations) > 0 {
		fmt.Printf("💡 권장사항:\n")
		maxRecs := min(len(result.Recommendations), 3)
		for i := 0; i < maxRecs; i++ {
			fmt.Printf("   • %s\n", result.Recommendations[i])
		}
	}

	fmt.Println()
}

// 배치 권장사항 출력
func printBatchRecommendations(batchResult *designtoken.BatchAnalysisResult) {
	fmt.Printf("🎯 전체 권장사항:\n")
	
	// 일관성 검사
	if batchResult.Summary.ValidFiles != batchResult.Summary.TotalFiles {
		fmt.Printf("   • 모든 파일의 검증 오류를 해결하세요\n")
	}
	
	// 토큰 수 균형 검사
	if len(batchResult.Results) > 1 {
		tokenCounts := make([]int, len(batchResult.Results))
		for i, result := range batchResult.Results {
			tokenCounts[i] = result.VariableCount
		}
		
		if hasImbalance(tokenCounts) {
			fmt.Printf("   • 토큰 파일 간 균형을 고려해보세요\n")
		}
	}
	
	fmt.Printf("   • 일관된 네이밍 규칙을 적용하세요\n")
	fmt.Printf("   • TailwindCSS나 CSS Variables로 활용을 고려해보세요\n")
	fmt.Println()
}

// 유틸리티 함수들
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func hasImbalance(counts []int) bool {
	if len(counts) < 2 {
		return false
	}
	
	max := counts[0]
	min := counts[0]
	
	for _, count := range counts[1:] {
		if count > max {
			max = count
		}
		if count < min {
			min = count
		}
	}
	
	// 최대값이 최소값의 3배 이상이면 불균형으로 판단
	return max > min*3
}