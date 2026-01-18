import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * @aplus/ui CSS 번들 서빙 API
 *
 * AI 생성 코드 미리보기 iframe에서 디자인 시스템 스타일을 적용하기 위한 CSS 제공
 *
 * 사용:
 *   <link href="/api/ui-bundle/css" rel="stylesheet">
 */
export async function GET() {
  try {
    // storybook-standalone/packages/ui/dist/ui.css 경로
    const cssPath = join(
      process.cwd(),
      "..",
      "..",
      "storybook-standalone",
      "packages",
      "ui",
      "dist",
      "ui.css"
    );

    const css = await readFile(cssPath, "utf-8");

    return new NextResponse(css, {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to load CSS bundle:", error);

    return NextResponse.json(
      {
        error: "CSS bundle not found",
        message:
          "Run 'pnpm build:umd' in storybook-standalone/packages/ui first",
      },
      { status: 404 }
    );
  }
}
