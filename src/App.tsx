import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireRole } from "@/components/RequireRole";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Inventory from "./pages/Inventory";
import Receiving from "./pages/Receiving";
import Orders from "./pages/Orders";
import Reports from "./pages/Reports";
import Accounts from "./pages/Accounts";
import RateCards from "./pages/RateCards";
import Settings from "./pages/Settings";
import Warehouses from "./pages/Warehouses";
import Locations from "./pages/Locations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/receiving" element={<ProtectedRoute><Receiving /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/warehouses" element={<ProtectedRoute><RequireRole role="tenant_admin"><Warehouses /></RequireRole></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><RequireRole role="tenant_admin"><Locations /></RequireRole></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><RequireRole role="tenant_admin"><Accounts /></RequireRole></ProtectedRoute>} />
            <Route path="/rate-cards" element={<ProtectedRoute><RequireRole role="tenant_admin"><RateCards /></RequireRole></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RequireRole role="tenant_admin"><Settings /></RequireRole></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
