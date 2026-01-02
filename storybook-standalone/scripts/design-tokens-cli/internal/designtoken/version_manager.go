// Package designtoken provides CVA-based React component generation from Figma Design Tokens
package designtoken

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

// VersionManager handles the versioning of design tokens.
type VersionManager struct {
	basePath              string // e.g., packages/ui
	packageJSONPath       string
	tokensBasePath        string
	componentDefsPath     string
	currentPackageVersion *semver.Version
	latestTokenVersion    *semver.Version
}

// NewVersionManager creates a new VersionManager.
func NewVersionManager(basePath string) (*VersionManager, error) {
	vm := &VersionManager{
		basePath:          basePath,
		packageJSONPath:   filepath.Join(basePath, "package.json"),
		tokensBasePath:    filepath.Join(basePath, "src/tokens"),
		componentDefsPath: filepath.Join(basePath, "src", "design-tokens", "component-definitions.json"),
	}

	if err := vm.loadVersions(); err != nil {
		return nil, err
	}

	return vm, nil
}

// loadVersions loads the package.json version and finds the latest token version.
func (vm *VersionManager) loadVersions() error {
	pkgBytes, err := os.ReadFile(vm.packageJSONPath)
	if err != nil {
		return fmt.Errorf("failed to read package.json at %s: %w", vm.packageJSONPath, err)
	}

	var pkg struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(pkgBytes, &pkg); err != nil {
		return fmt.Errorf("failed to parse version from package.json: %w", err)
	}

	currentPkgVer, err := semver.NewVersion(pkg.Version)
	if err != nil {
		return fmt.Errorf("invalid version in package.json: %w", err)
	}
	vm.currentPackageVersion = currentPkgVer

	latestVer, err := vm.findLatestTokenVersion()
	if err != nil {
		return fmt.Errorf("failed to find latest token version: %w", err)
	}
	if latestVer == nil {
		vm.latestTokenVersion, _ = semver.NewVersion("0.0.0")
	} else {
		vm.latestTokenVersion = latestVer
	}

	return nil
}

// findLatestTokenVersion scans the tokens directory to find the highest version number.
func (vm *VersionManager) findLatestTokenVersion() (*semver.Version, error) {
	var versions []*semver.Version
	majorDirs, err := filepath.Glob(filepath.Join(vm.tokensBasePath, "v*"))
	if err != nil {
		return nil, err
	}

	for _, majorDir := range majorDirs {
		minorDirs, err := filepath.Glob(filepath.Join(majorDir, "v*.*"))
		if err != nil {
			return nil, err
		}

		for _, minorDir := range minorDirs {
			files, err := filepath.Glob(filepath.Join(minorDir, "structured-tokens.v*.*.*.ts"))
			if err != nil {
				return nil, err
			}

			for _, file := range files {
				re := regexp.MustCompile(`structured-tokens\.v(\d+\.\d+\.\d+)\.ts$`)
				matches := re.FindStringSubmatch(filepath.Base(file))
				if len(matches) > 1 {
					ver, err := semver.NewVersion(matches[1])
					if err == nil {
						versions = append(versions, ver)
					}
				}
			}
		}
	}

	if len(versions) == 0 {
		return nil, nil
	}

	sort.Sort(sort.Reverse(semver.Collection(versions)))
	return versions[0], nil
}

// GetNextVersion determines the next version based on content changes.
func (vm *VersionManager) GetNextVersion(newContent string) (nextVersion *semver.Version, needsUpdate bool, componentDefsChanged bool, err error) {
	if vm.currentPackageVersion.LessThan(vm.latestTokenVersion) {
		return nil, false, false, fmt.Errorf(
			"version downgrade detected: package.json version (%s) is lower than the latest token version (%s)",
			vm.currentPackageVersion.String(),
			vm.latestTokenVersion.String(),
		)
	}

	if vm.currentPackageVersion.Major() > vm.latestTokenVersion.Major() ||
		(vm.currentPackageVersion.Major() == vm.latestTokenVersion.Major() && vm.currentPackageVersion.Minor() > vm.latestTokenVersion.Minor()) {
		newVerStr := fmt.Sprintf("%d.%d.1", vm.currentPackageVersion.Major(), vm.currentPackageVersion.Minor())
		newVer, err := semver.NewVersion(newVerStr)
		if err != nil {
			return nil, false, false, fmt.Errorf("failed to create new version for major/minor update: %w", err)
		}
		return newVer, true, true, nil
	}

	latestTokenPath := vm.GetVersionedPath(vm.latestTokenVersion, "structured-tokens.ts")
	latestContent, err := os.ReadFile(latestTokenPath)

	// Handle the very first run (no previous token file existed).
	if os.IsNotExist(err) {
		currentDefsHash, _ := getComponentDefsHash(vm.componentDefsPath)
		componentDefsChanged = currentDefsHash != ""
		tokenContentChanged := newContent != ""
		needsUpdate = componentDefsChanged || tokenContentChanged

		if vm.currentPackageVersion.Equal(semver.MustParse("0.0.0")) {
			nextVer, _ := semver.NewVersion("0.0.1")
			return nextVer, needsUpdate, componentDefsChanged, nil
		}
		return vm.currentPackageVersion, needsUpdate, componentDefsChanged, nil
	}
	if err != nil {
		return nil, false, false, fmt.Errorf("could not read latest token file at %s: %w", latestTokenPath, err)
	}

	currentDefsHash, err := getComponentDefsHash(vm.componentDefsPath)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to get hash of component-definitions.json: %w", err)
	}
	
	previousDefsHash := extractHashFromTokenContent(string(latestContent))
	componentDefsChanged = (currentDefsHash != previousDefsHash)
	cleanOldContent := regexp.MustCompile(`// component-definitions-hash: .*\n`).ReplaceAllString(string(latestContent), "")
	tokenContentChanged := (cleanOldContent != newContent)
	needsUpdate = componentDefsChanged || tokenContentChanged

	if !needsUpdate {
		return vm.latestTokenVersion, false, false, nil
	}

	nextVer := vm.latestTokenVersion.IncPatch()
	return &nextVer, true, componentDefsChanged, nil
}

// GetVersionedPath returns the full path for a given version.
func (vm *VersionManager) GetVersionedPath(version *semver.Version, filename string) string {
	major := fmt.Sprintf("v%d", version.Major())
	minor := fmt.Sprintf("v%d.%d", version.Major(), version.Minor())
	
	var versionedFilename string
	if strings.Contains(filename, "structured-tokens") {
		versionedFilename = fmt.Sprintf("structured-tokens.v%s.ts", version.String())
	} else if strings.Contains(filename, "component-definitions") {
		versionedFilename = fmt.Sprintf("component-definitions.v%s.json", version.String())
	} else {
		versionedFilename = filename
	}
	
	return filepath.Join(vm.tokensBasePath, major, minor, versionedFilename)
}

// UpdatePackageJSONVersion updates the version in the package.json file.
func (vm *VersionManager) UpdatePackageJSONVersion(newVersion *semver.Version) error {
	pkgBytes, err := os.ReadFile(vm.packageJSONPath)
	if err != nil {
		return fmt.Errorf("failed to read package.json for update: %w", err)
	}

	var pkgData map[string]interface{}
	if err := json.Unmarshal(pkgBytes, &pkgData); err != nil {
		return fmt.Errorf("failed to unmarshal package.json for update: %w", err)
	}

	pkgData["version"] = newVersion.String()

	updatedPkgBytes, err := json.MarshalIndent(pkgData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated package.json: %w", err)
	}

	err = os.WriteFile(vm.packageJSONPath, updatedPkgBytes, 0644)
	if err != nil {
		return fmt.Errorf("failed to write updated package.json at %s: %w", vm.packageJSONPath, err)
	}
	return nil
}

// GenerateChangelog compares two versions and updates the version-specific changelog.
func (vm *VersionManager) GenerateChangelog(oldVersion, newVersion *semver.Version, newContent string, componentDefsChanged bool) (string, error) {
	var changelogPath string
	changelogFilename := fmt.Sprintf("changelog.v%d.%d.md", newVersion.Major(), newVersion.Minor())

	versionedTokenPath := vm.GetVersionedPath(newVersion, "structured-tokens.ts")
	changelogPath = filepath.Join(filepath.Dir(versionedTokenPath), changelogFilename)

	var oldContent string
	if !oldVersion.Equal(semver.MustParse("0.0.0")) {
		oldTokenPath := vm.GetVersionedPath(oldVersion, "structured-tokens.ts")
		oldBytes, err := os.ReadFile(oldTokenPath)
		if err == nil {
			oldContent = string(oldBytes)
		}
	}

	cleanOldContent := regexp.MustCompile(`// component-definitions-hash: .*\n`).ReplaceAllString(oldContent, "")
	cleanNewContent := regexp.MustCompile(`// component-definitions-hash: .*\n`).ReplaceAllString(newContent, "")

	oldTokens := parseTokens(cleanOldContent)
	newTokens := parseTokens(cleanNewContent)

	var added, removed, changed []string
	var defAdded, defChanged, defRemoved []string

	for key, newVal := range newTokens {
		if oldVal, exists := oldTokens[key]; exists {
			if oldVal != newVal {
				changed = append(changed, fmt.Sprintf("`%s` changed from `%s` to `%s`", key, oldVal, newVal))
			}
		} else {
			added = append(added, fmt.Sprintf("`%s: %s`", key, newVal))
		}
	}

	for key, oldVal := range oldTokens {
		if _, exists := newTokens[key]; !exists {
			removed = append(removed, fmt.Sprintf("`%s: %s`", key, oldVal))
		}
	}

	sort.Strings(added)
	sort.Strings(removed)
	sort.Strings(changed)

	isNewMinorOrMajor := newVersion.Major() > oldVersion.Major() || newVersion.Minor() > oldVersion.Minor()

	var entry strings.Builder
	entry.WriteString(fmt.Sprintf("## [%s] - %s\n\n", newVersion.String(), time.Now().Format("2006-01-02")))

	if !componentDefsChanged && len(added) == 0 && len(removed) == 0 && len(changed) == 0 {
		if isNewMinorOrMajor {
			entry.WriteString("### Changed\n")
			entry.WriteString("- Nothing Changed. Version bumped for new release cycle.\n\n")
		} else {
			return "", nil
		}
	} else {
		if componentDefsChanged {
			entry.WriteString("### Component Definition Changes\n")
			
			var oldDefsContent string
			if !oldVersion.Equal(semver.MustParse("0.0.0")) {
				oldDefsPath := vm.GetVersionedPath(oldVersion, "component-definitions.json")
				oldDefsBytes, err := os.ReadFile(oldDefsPath)
				if err == nil {
					oldDefsContent = string(oldDefsBytes)
				}
			}
			if oldDefsContent == "" { oldDefsContent = "{}" }

			newDefsBytes, err := os.ReadFile(vm.componentDefsPath)
			if err != nil {
				entry.WriteString("- Could not read component definitions to generate detailed diff.\n\n")
			} else {
				defAdded, defChanged, defRemoved = diffJSONObjects(oldDefsContent, string(newDefsBytes))
				if len(defAdded) == 0 && len(defChanged) == 0 && len(defRemoved) == 0 {
					entry.WriteString("- Updated component structures and variants.\n\n")
				} else {
					for _, item := range defAdded { entry.WriteString(fmt.Sprintf("- `Added`: %s\n", item)) }
					for _, item := range defChanged { entry.WriteString(fmt.Sprintf("- `Changed`: %s\n", item)) }
					for _, item := range defRemoved { entry.WriteString(fmt.Sprintf("- `Removed`: %s\n", item)) }
					entry.WriteString("\n")
				}
			}
		}
		if len(added) > 0 {
			entry.WriteString("### Token Value Changes (Added)\n")
			for _, l := range added {
				entry.WriteString(fmt.Sprintf("- %s\n", l))
			}
			entry.WriteString("\n")
		}
		if len(changed) > 0 {
			entry.WriteString("### Token Value Changes (Changed)\n")
			for _, l := range changed {
				entry.WriteString(fmt.Sprintf("- %s\n", l))
			}
			entry.WriteString("\n")
		}
		if len(removed) > 0 {
			entry.WriteString("### Token Value Changes (Removed)\n")
			for _, l := range removed {
				entry.WriteString(fmt.Sprintf("- %s\n", l))
			}
			entry.WriteString("\n")
		}
	}

	existingChangelog, _ := os.ReadFile(changelogPath)
	if strings.Contains(string(existingChangelog), fmt.Sprintf("## [%s]", newVersion.String())) {
		return "", nil
	}

	newChangelog := append([]byte(entry.String()), existingChangelog...)
	if err := os.WriteFile(changelogPath, newChangelog, 0644); err != nil {
		return "", err
	}
	return changelogPath, nil
}

// parseTokens extracts token key-value pairs from the content of a structured-tokens.ts file.
func parseTokens(content string) map[string]string {
	tokens := make(map[string]string)
	objectRegex := regexp.MustCompile(`(?s)export const (\w+) = {(.+?)} as const;`)

	matches := objectRegex.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		objectName := match[1]
		objectContent := strings.TrimSpace(match[2])

		i := 0
		for i < len(objectContent) {
			startKey := strings.Index(objectContent[i:], "'")
			if startKey == -1 { break }
			startKey += i + 1

			endKey := strings.Index(objectContent[startKey:], "'")
			if endKey == -1 { break }
			endKey += startKey
			key := objectName + "." + objectContent[startKey:endKey]

			colon := strings.Index(objectContent[endKey:], ":")
			if colon == -1 { break }
			colon += endKey

			valueStart := colon + 1
			for valueStart < len(objectContent) && (objectContent[valueStart] == ' ' || objectContent[valueStart] == '\n' || objectContent[valueStart] == '\t') {
				valueStart++
			}

			if valueStart >= len(objectContent) { break }

			valueEnd := -1
			if objectContent[valueStart] == '{' {
				braceCount := 1
				for j := valueStart + 1; j < len(objectContent); j++ {
					if objectContent[j] == '{' { braceCount++ } else if objectContent[j] == '}' {
						braceCount--
						if braceCount == 0 { valueEnd = j + 1; break }
					}
				}
			} else {
				inParens := false
				for j := valueStart; j < len(objectContent); j++ {
					if objectContent[j] == '(' { inParens = true } else if objectContent[j] == ')' { inParens = false } else if (objectContent[j] == ',' || objectContent[j] == '\n') && !inParens {
						valueEnd = j
						break
					}
				}
				if valueEnd == -1 { valueEnd = len(objectContent) }
			}

			if valueEnd != -1 {
				value := strings.TrimSpace(objectContent[valueStart:valueEnd])
				value = strings.TrimRight(value, ",")
				value = strings.ReplaceAll(value, "\n", " ")
				value = regexp.MustCompile(`\s+`).ReplaceAllString(value, " ")
				tokens[key] = value
				i = valueEnd
			} else { break }
		}
	}
	return tokens
}

func getComponentDefsHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) { return "", nil }
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil { return "", err }

	return hex.EncodeToString(h.Sum(nil)), nil
}

func extractHashFromTokenContent(content string) string {
	re := regexp.MustCompile(`// component-definitions-hash: (\w+)`)
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 { return matches[1] }
	return ""
}

func diffJSONObjects(oldJSON, newJSON string) (added, changed, removed []string) {
	var oldData, newData map[string]interface{}
	json.Unmarshal([]byte(oldJSON), &oldData)
	json.Unmarshal([]byte(newJSON), &newData)

	allKeys := make(map[string]bool)
	for k := range oldData {
		allKeys[k] = true
	}
	for k := range newData {
		allKeys[k] = true
	}

	var sortedKeys []string
	for k := range allKeys {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	for _, key := range sortedKeys {
		v1, ok1 := oldData[key]
		v2, ok2 := newData[key]

		if ok1 && !ok2 {
			removed = append(removed, fmt.Sprintf("`%s`", key))
			continue
		}
		if !ok1 && ok2 {
			newValStr, _ := json.Marshal(v2)
			added = append(added, fmt.Sprintf("`%s`: `%s`", key, newValStr))
			continue
		}
		if !reflect.DeepEqual(v1, v2) {
			// For nested objects, recursively diff
			if vm1, ok1 := v1.(map[string]interface{}); ok1 {
				if vm2, ok2 := v2.(map[string]interface{}); ok2 {
					subAdded, subChanged, subRemoved := diffJSONObjects(mapToJSON(vm1), mapToJSON(vm2))
					for _, s := range subAdded {
						added = append(added, fmt.Sprintf("`%s.%s`", key, strings.Trim(s, "`")))
					}
					for _, s := range subChanged {
						changed = append(changed, fmt.Sprintf("`%s.%s`", key, strings.Trim(s, "`")))
					}
					for _, s := range subRemoved {
						removed = append(removed, fmt.Sprintf("`%s.%s`", key, strings.Trim(s, "`")))
					}
					continue
				}
			}
			oldValStr, _ := json.Marshal(v1)
			newValStr, _ := json.Marshal(v2)
			changed = append(changed, fmt.Sprintf("`%s` from `%s` to `%s`", key, oldValStr, newValStr))
		}
	}
	return
}

func mapToJSON(m map[string]interface{}) string {
	b, _ := json.Marshal(m)
	return string(b)
}
