// Build cache buster: 2026-01-25-v2
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireRole } from "@/components/RequireRole";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Inventory from "./pages/Inventory";
import ItemDetail from "./pages/ItemDetail";

import Reports from "./pages/Reports";
import Accounts from "./pages/Accounts";
import Settings from "./pages/Settings";
import Shipments from "./pages/Shipments";
import ShipmentsList from "./pages/ShipmentsList";
import ShipmentDetail from "./pages/ShipmentDetail";
import ShipmentCreate from "./pages/ShipmentCreate";
import OutboundCreate from "./pages/OutboundCreate";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Billing from "./pages/Billing";
import BillingReports from "./pages/BillingReports";
import BillingReport from "./pages/BillingReport";
import Invoices from "./pages/Invoices";
import Employees from "./pages/Employees";
import Claims from "./pages/Claims";
import ClaimDetail from "./pages/ClaimDetail";
import CoverageQuickEntry from "./pages/CoverageQuickEntry";
import Stocktakes from "./pages/Stocktakes";
import StocktakeScanView from "./components/stocktakes/StocktakeScanView";
import StocktakeReport from "./components/stocktakes/StocktakeReport";
import Manifests from "./pages/Manifests";
import ManifestDetail from "./pages/ManifestDetail";
import ManifestScan from "./pages/ManifestScan";
import RepairTechAccess from "./pages/RepairTechAccess";
import TechQuoteSubmit from "./pages/TechQuoteSubmit";
import Technicians from "./pages/Technicians";
import RepairQuotes from "./pages/RepairQuotes";
import Quotes from "./pages/Quotes";
import QuoteBuilder from "./pages/QuoteBuilder";
import QuoteAcceptance from "./pages/QuoteAcceptance";
import ClientQuoteReview from "./pages/ClientQuoteReview";
import ClientActivate from "./pages/ClientActivate";
import ClaimAcceptance from "./pages/ClaimAcceptance";
import ClientLogin from "./pages/ClientLogin";
import ClientDashboard from "./pages/ClientDashboard";
import ClientItems from "./pages/ClientItems";
import ClientQuotes from "./pages/ClientQuotes";
import ClientClaims from "./pages/ClientClaims";
import ScanHub from "./pages/ScanHub";
import ScanItemRedirect from "./pages/ScanItemRedirect";
import PrintPreview from "./pages/PrintPreview";
import Diagnostics from "./pages/Diagnostics";
import Messages from "./pages/Messages";
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
          <SidebarProvider>
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
            <Route path="/shipments/outbound/new" element={<ProtectedRoute><OutboundCreate /></ProtectedRoute>} />
            <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanHub /></ProtectedRoute>} />
            <Route path="/scan/item/:codeOrId" element={<ProtectedRoute><ScanItemRedirect /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><RequireRole role="tenant_admin"><Billing /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/reports" element={<ProtectedRoute><RequireRole role="tenant_admin"><BillingReports /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/report" element={<ProtectedRoute><RequireRole role="tenant_admin"><BillingReport /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/invoices" element={<ProtectedRoute><RequireRole role="tenant_admin"><Invoices /></RequireRole></ProtectedRoute>} />
            <Route path="/claims" element={<ProtectedRoute><RequireRole role="tenant_admin"><Claims /></RequireRole></ProtectedRoute>} />
            <Route path="/claims/:id" element={<ProtectedRoute><RequireRole role="tenant_admin"><ClaimDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/coverage" element={<ProtectedRoute><RequireRole role="tenant_admin"><CoverageQuickEntry /></RequireRole></ProtectedRoute>} />
            <Route path="/stocktakes" element={<ProtectedRoute><Stocktakes /></ProtectedRoute>} />
            <Route path="/stocktakes/:id/scan" element={<ProtectedRoute><StocktakeScanView /></ProtectedRoute>} />
            <Route path="/stocktakes/:id/report" element={<ProtectedRoute><StocktakeReport /></ProtectedRoute>} />
            <Route path="/manifests" element={<ProtectedRoute><Manifests /></ProtectedRoute>} />
            <Route path="/manifests/:id" element={<ProtectedRoute><ManifestDetail /></ProtectedRoute>} />
            <Route path="/manifests/:id/scan" element={<ProtectedRoute><ManifestScan /></ProtectedRoute>} />
            <Route path="/manifests/:id/history" element={<ProtectedRoute><ManifestDetail /></ProtectedRoute>} />
            
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><RequireRole role="tenant_admin"><Accounts /></RequireRole></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><RequireRole role="tenant_admin"><Employees /></RequireRole></ProtectedRoute>} />
            <Route path="/technicians" element={<ProtectedRoute><RequireRole role="tenant_admin"><Technicians /></RequireRole></ProtectedRoute>} />
            <Route path="/repair-quotes" element={<ProtectedRoute><RequireRole role="tenant_admin"><RepairQuotes /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><RequireRole role="tenant_admin"><Quotes /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes/new" element={<ProtectedRoute><RequireRole role="tenant_admin"><QuoteBuilder /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes/:id" element={<ProtectedRoute><RequireRole role="tenant_admin"><QuoteBuilder /></RequireRole></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RequireRole role="tenant_admin"><Settings /></RequireRole></ProtectedRoute>} />
            <Route path="/diagnostics" element={<ProtectedRoute><RequireRole role="tenant_admin"><Diagnostics /></RequireRole></ProtectedRoute>} />
            <Route path="/repair-access" element={<RepairTechAccess />} />
            <Route path="/quote/tech" element={<TechQuoteSubmit />} />
            <Route path="/quote/review" element={<ClientQuoteReview />} />
            <Route path="/claim/accept/:token" element={<ClaimAcceptance />} />
            <Route path="/quote/accept" element={<QuoteAcceptance />} />
            <Route path="/activate" element={<ClientActivate />} />
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="/client/items" element={<ProtectedRoute><ClientItems /></ProtectedRoute>} />
            <Route path="/client/quotes" element={<ProtectedRoute><ClientQuotes /></ProtectedRoute>} />
            <Route path="/client/claims" element={<ProtectedRoute><ClientClaims /></ProtectedRoute>} />
            <Route path="/components-demo" element={<ProtectedRoute><ComponentsDemo /></ProtectedRoute>} />
            <Route path="/print-preview" element={<PrintPreview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIClientBot />
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
