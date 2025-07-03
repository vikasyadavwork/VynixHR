import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInCard } from "./_components/sign-in/card";

export const HomePage = () => {
  return (
    <section className="w-full h-screen overflow-hidden">
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay for gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-900 via-purple-900 to-orange-900 opacity-80" />

      {/* Content container */}
      <div className="relative z-10 text-white flex flex-col items-center justify-center min-h-screen py-16 px-4">
        <h1 className="font-extrabold text-4xl text-center mb-4 md:text-5xl lg:text-6xl drop-shadow-lg text-blue-400">
          Welcome to EmPulse HR
        </h1>
        <p className="text-lg text-center text-blue-200 mb-8 md:max-w-2xl md:mx-auto">
          Let’s make every workday efficient, seamless, and empowered.
        </p>
        <div className="md:max-w-lg md:mx-auto w-full">
          <Tabs defaultValue="signIn">
            <TabsList className="grid grid-cols-1 bg-blue-700 text-white rounded-lg shadow-lg">
              <TabsTrigger
                value="signIn"
                className="py-2 font-medium text-lg hover:bg-blue-600 transition duration-150 rounded-lg"
              >
                Sign in with the credentials provided by the administrator
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signIn" className="mt-6">
              <SignInCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
};
