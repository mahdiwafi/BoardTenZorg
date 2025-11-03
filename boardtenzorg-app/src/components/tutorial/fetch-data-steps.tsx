const steps = [
  "Create a Supabase table or view you want to expose to clients.",
  "Add a server action or route handler that queries Supabase with Row Level Security in mind.",
  "Call the server action from a client component, or use it directly inside Server Components with streaming.",
];

export function FetchDataSteps() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
