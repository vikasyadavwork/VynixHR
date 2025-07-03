import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CreateAccountForm } from "./form";

export const CreateAccountCard = () => {
  return (
    <section className="cs-section bg- min-h-screen">
      <CardContent>
        <CreateAccountForm />
        <TabsTrigger
          value="signIn"
          className="py-2 font-roboto italic font-bold text-lg text-cadetblue-300"
        >
          Sign in with the credentials provided by the administrator.
        </TabsTrigger>
      </CardContent>
    </section>
  );
};

module.exports = {
  theme: {
    extend: {
      fontFamily: {
        roboto: ['Roboto', 'sans-serif'],
      },
    },
  },
};
