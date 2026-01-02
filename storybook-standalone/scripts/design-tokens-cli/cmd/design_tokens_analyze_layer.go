package cmd

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"

	"github.com/spf13/cobra"
)

var (
	figmaURL   string
	figmaToken string
)

var analyzeLayerCmd = &cobra.Command{
	Use:   "analyze-layer [output-file]",
	Short: "Analyze a Figma layer URL to generate a design token JSON file.",
	Long: `Analyzes a specific layer from a Figma design file URL, extracts design token information,
and generates a JSON file compatible with the 'generate' command.`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		outputFile := args[0]
		fmt.Printf("Analyzing Figma URL: %s\n", figmaURL)

		fileKey, nodeID, err := parseFigmaURL(figmaURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("  -> Extracted File Key: %s\n", fileKey)
		fmt.Printf("  -> Extracted Node ID: %s\n", nodeID)
		fmt.Printf("  -> Output File: %s\n", outputFile)

		if figmaToken == "" {
			figmaToken = os.Getenv("FIGMA_API_TOKEN")
		}
		if figmaToken == "" {
			fmt.Fprintln(os.Stderr, "Error: Figma API token not provided. Use --token flag or set FIGMA_API_TOKEN environment variable.")
			os.Exit(1)
		}

		// Call Figma API
		apiUrl := fmt.Sprintf("https://api.figma.com/v1/files/%s/nodes?ids=%s", fileKey, nodeID)
		req, err := http.NewRequest("GET", apiUrl, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating request: %v\n", err)
			os.Exit(1)
		}
		req.Header.Set("X-FIGMA-TOKEN", figmaToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error making request to Figma API: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Fprintf(os.Stderr, "Error: Figma API returned status code %d\n", resp.StatusCode)
			body, _ := io.ReadAll(resp.Body)
			fmt.Fprintf(os.Stderr, "Response: %s\n", string(body))
			os.Exit(1)
		}

		// Write raw response to output file
		outFile, err := os.Create(outputFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating output file: %v\n", err)
			os.Exit(1)
		}
		defer outFile.Close()

		_, err = io.Copy(outFile, resp.Body)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error writing to output file: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("\nSuccessfully fetched data from Figma API and saved raw response to %s\n", outputFile)
	},
}

// parseFigmaURL extracts the file key and node ID from a Figma URL.
func parseFigmaURL(rawURL string) (string, string, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}

	re := regexp.MustCompile(`/design/([^/]+)`)
	matches := re.FindStringSubmatch(parsedURL.Path)
	if len(matches) < 2 {
		return "", "", fmt.Errorf("could not find Figma file key in URL path")
	}
	fileKey := matches[1]

	nodeID := parsedURL.Query().Get("node-id")
	if nodeID == "" {
		return "", "", fmt.Errorf("could not find 'node-id' in URL query parameters")
	}

	return fileKey, nodeID, nil
}

func init() {
	analyzeLayerCmd.Flags().StringVar(&figmaURL, "url", "", "Full Figma URL to the design layer (required)")
	analyzeLayerCmd.Flags().StringVar(&figmaToken, "token", "", "Figma API token (or set FIGMA_API_TOKEN env var)")
	analyzeLayerCmd.MarkFlagRequired("url")
}
