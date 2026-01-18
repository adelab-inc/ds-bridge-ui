import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * @aplus/ui UMD 번들 서빙 API
 *
 * AI 생성 코드 미리보기 iframe에서 디자인 시스템 컴포넌트를 사용하기 위한 UMD 번들 제공
 *
 * 사용:
 *   <script src="/api/ui-bundle"></script>
 *
 * 브라우저에서:
 *   window.AplusUI.Button, window.AplusUI.Chip 등으로 접근
 */
export async function GET() {
  try {
    // storybook-standalone/packages/ui/dist/ui.umd.js 경로
    const bundlePath = join(
      process.cwd(),
      "..",
      "..",
      "storybook-standalone",
      "packages",
      "ui",
      "dist",
      "ui.umd.js"
    );

    const bundle = await readFile(bundlePath, "utf-8");

    return new NextResponse(bundle, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to load UMD bundle:", error);

    return NextResponse.json(
      {
        error: "UMD bundle not found",
        message:
          "Run 'pnpm build:umd' in storybook-standalone/packages/ui first",
      },
      { status: 404 }
    );
  }
}
