package cmd

import (
	"github.com/spf13/cobra"
)

var verbose bool

var designTokensCmd = &cobra.Command{
	Use:   "design-tokens",
	Short: "디자인 토큰 관련 도구",
	Long:  `디자인 토큰을 분석하거나 UI 컴포넌트를 생성하는 등 다양한 작업을 수행합니다.`,
}

func init() {
	rootCmd.AddCommand(designTokensCmd)
	designTokensCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "상세 출력 활성화")
	designTokensCmd.AddCommand(designTokensGenerateCmd)
}
