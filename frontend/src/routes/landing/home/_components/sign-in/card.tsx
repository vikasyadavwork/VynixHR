import {
  CardContent
} from "@/components/ui/card";
import { SignInForm } from "./form";

export const SignInCard = () => {
  return (
    <section className="cs-section  min-h-screen">
      <CardContent>
        <SignInForm />
      </CardContent>
    </section>
  );
};
