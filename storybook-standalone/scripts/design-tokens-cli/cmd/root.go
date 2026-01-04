/*
Design Token CLI - Storybook Standalone
*/
package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "design-tokens-cli",
	Short: "Design Token 생성 및 분석 CLI",
	Long: `Design Token 관리를 위한 명령줄 인터페이스 도구입니다.

이 도구는 다음과 같은 기능을 제공합니다:
• Figma/JSON 토큰 분석
• structured-tokens.ts 생성
• design-tokens.ts 생성
• Tailwind 프리셋 생성`,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	// design-tokens 명령어만 등록
}
