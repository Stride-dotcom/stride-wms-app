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
import ItemDetail from "./pages/ItemDetail";

import Reports from "./pages/Reports";
import Accounts from "./pages/Accounts";
import RateCards from "./pages/RateCards";
import Settings from "./pages/Settings";
import Shipments from "./pages/Shipments";
import ShipmentsList from "./pages/ShipmentsList";
import ShipmentDetail from "./pages/ShipmentDetail";
import ShipmentCreate from "./pages/ShipmentCreate";
import Tasks from "./pages/Tasks";
import Billing from "./pages/Billing";
import Employees from "./pages/Employees";
import Claims from "./pages/Claims";
import Stocktakes from "./pages/Stocktakes";
import RepairTechAccess from "./pages/RepairTechAccess";
import ScanHub from "./pages/ScanHub";
import PrintPreview from "./pages/PrintPreview";
import Diagnostics from "./pages/Diagnostics";
import ComponentsDemo from "./pages/ComponentsDemo";
import NotFound from "./pages/NotFound";
import { AIClientBot } from "./components/ai/AIClientBot";

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
            <Route path="/inventory/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
            <Route path="/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
            <Route path="/shipments/list" element={<ProtectedRoute><ShipmentsList /></ProtectedRoute>} />
            <Route path="/shipments/incoming" element={<ProtectedRoute><ShipmentsList /></ProtectedRoute>} />
            <Route path="/shipments/outbound" element={<ProtectedRoute><ShipmentsList /></ProtectedRoute>} />
            <Route path="/shipments/received" element={<ProtectedRoute><ShipmentsList /></ProtectedRoute>} />
            <Route path="/shipments/released" element={<ProtectedRoute><ShipmentsList /></ProtectedRoute>} />
            <Route path="/shipments/new" element={<ProtectedRoute><ShipmentCreate /></ProtectedRoute>} />
            <Route path="/shipments/create" element={<ProtectedRoute><ShipmentCreate /></ProtectedRoute>} />
            <Route path="/shipments/return/new" element={<ProtectedRoute><ShipmentCreate /></ProtectedRoute>} />
            <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanHub /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><RequireRole role="tenant_admin"><Billing /></RequireRole></ProtectedRoute>} />
            <Route path="/claims" element={<ProtectedRoute><RequireRole role="tenant_admin"><Claims /></RequireRole></ProtectedRoute>} />
            <Route path="/stocktakes" element={<ProtectedRoute><Stocktakes /></ProtectedRoute>} />
            
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><RequireRole role="tenant_admin"><Accounts /></RequireRole></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><RequireRole role="tenant_admin"><Employees /></RequireRole></ProtectedRoute>} />
            <Route path="/rate-cards" element={<ProtectedRoute><RequireRole role="tenant_admin"><RateCards /></RequireRole></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RequireRole role="tenant_admin"><Settings /></RequireRole></ProtectedRoute>} />
            <Route path="/diagnostics" element={<ProtectedRoute><RequireRole role="tenant_admin"><Diagnostics /></RequireRole></ProtectedRoute>} />
            <Route path="/repair-access" element={<RepairTechAccess />} />
            <Route path="/components-demo" element={<ProtectedRoute><ComponentsDemo /></ProtectedRoute>} />
            <Route path="/print-preview" element={<PrintPreview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIClientBot />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
