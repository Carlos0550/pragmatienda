import { Toaster } from "sileo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "@/AppRoutes";
import { ClientBootstrap } from "@/components/ClientBootstrap";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster
        position="top-right"
        options={{
          fill: '#1a1a1a',
          styles: {
            title: 'text-white font-semibold opacity-100!',
            description: 'text-white opacity-90!',
          },
          duration: 2500,
        }}
      />
      <BrowserRouter>
        <ClientBootstrap>
          <AppRoutes />
        </ClientBootstrap>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
