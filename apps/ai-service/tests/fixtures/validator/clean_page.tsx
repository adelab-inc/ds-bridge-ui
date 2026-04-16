import { Button, Field, GridLayout, TitleSection } from "@/components";

export default function Page() {
  return (
    <GridLayout type="A">
      <div>
        <TitleSection title="제목" />
        <Field label="이메일" />
        <Button variant="primary">로그인</Button>
      </div>
    </GridLayout>
  );
}
