package cmd

import (
	"design-tokens-cli/internal/designtoken"
	"fmt"

	"github.com/spf13/cobra"
)

var designTokensGenerateCmd = &cobra.Command{
	Use:   "generate [input-files...]",
	Short: "디자인 토큰 파일로부터 UI 시스템 코드를 생성합니다.",
	Long: `Figma 디자인 토큰 파일(color.json 등)을 입력받아, 
참조 관계가 유지되는 structured-tokens.ts와 
최종 값으로 변환된 design-tokens.ts 파일을 생성합니다.

이 명령어는 디자인 시스템의 아키텍처를 코드에 명시적으로 반영하여
자동화 워크플로우를 복구하고 유지보수성을 향상시키는 것을 목표로 합니다.

예시:
  design-tokens-cli design-tokens generate --output-dir packages/ui/tokens color.json
`,
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		outputDir, _ := cmd.Flags().GetString("output-dir")
		generateUI, _ := cmd.Flags().GetBool("generate-ui")

		if outputDir == "" {
			return fmt.Errorf("Error: --output-dir 플래그는 필수입니다")
		}

		loader := designtoken.NewSafeJsonLoader()
		collections := make(map[string]*designtoken.DesignTokenCollection)
		for _, inputFile := range args {
			collection, err := loader.LoadDesignTokenCollection(inputFile)
			if err != nil {
				return fmt.Errorf("디자인 토큰 파일 로드 실패 %s: %w", inputFile, err)
			}
			collections[collection.Name] = collection
		}

		// 토큰 파일 생성 (기본 동작)
		// 이 부분은 cva_generator.go 내부 로직과 중복되므로, cva_generator를 항상 사용하도록 통합합니다.
		generator := designtoken.NewCVAGenerator()
		options := &designtoken.CVAGenerationOptions{
			OutputDir: outputDir,
			Verbose:   verbose,
		}

		result, err := generator.Generate(collections, options, generateUI)
		if err != nil {
			return fmt.Errorf("UI 시스템 생성 실패: %w", err)
		}

		if !result.Success {
			errorMsg := "UI 시스템 생성 과정에서 오류 발생:\n"
			for _, e := range result.Errors {
				errorMsg += fmt.Sprintf("- %s\n", e)
			}
			return fmt.Errorf(errorMsg)
		}

		fmt.Println("성공적으로 UI 시스템 관련 파일을 생성/업데이트했습니다.")
		for _, file := range result.GeneratedFiles {
			fmt.Printf("- 생성된 파일: %s (%s)\n", file.Path, file.Description)
		}

		return nil
	},
}

func init() {
	designTokensCmd.AddCommand(designTokensGenerateCmd)
	designTokensGenerateCmd.Flags().StringP("output-dir", "o", "", "생성된 토큰 파일을 저장할 디렉토리 (필수)")
	designTokensGenerateCmd.Flags().Bool("generate-ui", false, "CVA 기반 UI 컴포넌트, Tailwind 프리셋 등 관련 파일을 함께 생성합니다.")
}
