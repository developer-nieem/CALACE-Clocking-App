import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
        <Badge variant="accent">Coming in a later phase</Badge>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">{description}</p>
        <Button className="mt-6" disabled>
          Not available yet
        </Button>
      </CardContent>
    </Card>
  );
}
