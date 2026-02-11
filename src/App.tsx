// Build cache buster: 2026-01-25-v2
// Replaced by AppleBanner system — remove after verification
// import { Toaster } from "@/components/ui/toaster";
// import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AppleBannerProvider } from "@/contexts/AppleBannerContext";
import { PromptProvider } from "@/components/prompts";
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
import PromoCodes from "./pages/PromoCodes";
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
import RepairQuoteDetail from "./pages/RepairQuoteDetail";
import Quotes from "./pages/Quotes";
import QuoteBuilder from "./pages/QuoteBuilder";
import QuoteAcceptance from "./pages/QuoteAcceptance";
import ClientQuoteReview from "./pages/ClientQuoteReview";
import ClientActivate from "./pages/ClientActivate";
import SmsOptIn from "./pages/SmsOptIn";
import ClaimAcceptance from "./pages/ClaimAcceptance";
import ClientLogin from "./pages/ClientLogin";
import ClientDashboard from "./pages/ClientDashboard";
import ClientItems from "./pages/ClientItems";
import ClientQuotes from "./pages/ClientQuotes";
import ClientClaims from "./pages/ClientClaims";
import ClientShipments from "./pages/ClientShipments";
import ClientShipmentDetail from "./pages/ClientShipmentDetail";
import ClientInboundCreate from "./pages/ClientInboundCreate";
import ClientOutboundCreate from "./pages/ClientOutboundCreate";
import ClientTaskCreate from "./pages/ClientTaskCreate";
import ScanHub from "./pages/ScanHub";
import ScanItemRedirect from "./pages/ScanItemRedirect";
import PrintPreview from "./pages/PrintPreview";
import Diagnostics from "./pages/Diagnostics";
import BotQA from "./pages/admin/BotQA";
import QACenter from "./pages/QACenter";
import Messages from "./pages/Messages";
import ComponentsDemo from "./pages/ComponentsDemo";
import MaterialIconsSample from "./pages/MaterialIconsSample";
import LocationDetail from "./pages/LocationDetail";
import ContainerDetail from "./pages/ContainerDetail";
import IncomingManager from "./pages/IncomingManager";
import InboundManifestDetail from "./pages/InboundManifestDetail";
import ExpectedShipmentDetail from "./pages/ExpectedShipmentDetail";
import NotFound from "./pages/NotFound";
import { AIBotSwitch } from "./components/ai/AIBotSwitch";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Replaced by AppleBanner system — remove after verification */}
      <BrowserRouter>
        <AppleBannerProvider>
        <AuthProvider>
          <PromptProvider>
          <SidebarProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Dashboard /></RequireRole></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Inventory /></RequireRole></ProtectedRoute>} />
            <Route path="/inventory/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ItemDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/locations/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><LocationDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/containers/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ContainerDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/incoming" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><IncomingManager /></RequireRole></ProtectedRoute>} />
            <Route path="/incoming/manifest/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><InboundManifestDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/incoming/expected/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ExpectedShipmentDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Shipments /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/list" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentsList /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/incoming" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentsList /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/outbound" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentsList /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/received" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentsList /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/released" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentsList /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/new" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/create" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/return/new" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/outbound/new" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><OutboundCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/shipments/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ShipmentDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Tasks /></RequireRole></ProtectedRoute>} />
            <Route path="/tasks/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><TaskDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ScanHub /></RequireRole></ProtectedRoute>} />
            <Route path="/scan/item/:codeOrId" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ScanItemRedirect /></RequireRole></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Messages /></RequireRole></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><RequireRole role="tenant_admin"><Billing /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/reports" element={<ProtectedRoute><RequireRole role="tenant_admin"><BillingReports /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/report" element={<ProtectedRoute><RequireRole role="tenant_admin"><BillingReport /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/invoices" element={<ProtectedRoute><RequireRole role="tenant_admin"><Invoices /></RequireRole></ProtectedRoute>} />
            <Route path="/billing/promo-codes" element={<ProtectedRoute><RequireRole role="tenant_admin"><PromoCodes /></RequireRole></ProtectedRoute>} />
            <Route path="/claims" element={<ProtectedRoute><RequireRole role="tenant_admin"><Claims /></RequireRole></ProtectedRoute>} />
            <Route path="/claims/:id" element={<ProtectedRoute><RequireRole role="tenant_admin"><ClaimDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/coverage" element={<ProtectedRoute><RequireRole role="tenant_admin"><CoverageQuickEntry /></RequireRole></ProtectedRoute>} />
            <Route path="/stocktakes" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Stocktakes /></RequireRole></ProtectedRoute>} />
            <Route path="/stocktakes/:id/scan" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><StocktakeScanView /></RequireRole></ProtectedRoute>} />
            <Route path="/stocktakes/:id/report" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><StocktakeReport /></RequireRole></ProtectedRoute>} />
            <Route path="/manifests" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Manifests /></RequireRole></ProtectedRoute>} />
            <Route path="/manifests/:id" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ManifestDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/manifests/:id/scan" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ManifestScan /></RequireRole></ProtectedRoute>} />
            <Route path="/manifests/:id/history" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><ManifestDetail /></RequireRole></ProtectedRoute>} />

            <Route path="/reports" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'warehouse_user']}><Reports /></RequireRole></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><RequireRole role="tenant_admin"><Accounts /></RequireRole></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><RequireRole role="tenant_admin"><Employees /></RequireRole></ProtectedRoute>} />
            <Route path="/technicians" element={<ProtectedRoute><RequireRole role="tenant_admin"><Technicians /></RequireRole></ProtectedRoute>} />
            <Route path="/repair-quotes" element={<ProtectedRoute><RequireRole role="tenant_admin"><RepairQuotes /></RequireRole></ProtectedRoute>} />
            <Route path="/repair-quotes/:id" element={<ProtectedRoute><RequireRole role="tenant_admin"><RepairQuoteDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><RequireRole role="tenant_admin"><Quotes /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes/new" element={<ProtectedRoute><RequireRole role="tenant_admin"><QuoteBuilder /></RequireRole></ProtectedRoute>} />
            <Route path="/quotes/:id" element={<ProtectedRoute><RequireRole role="tenant_admin"><QuoteBuilder /></RequireRole></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RequireRole role="tenant_admin"><Settings /></RequireRole></ProtectedRoute>} />
            {/* QA/Dev tooling: allow system-level admin_dev access */}
            <Route path="/diagnostics" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'admin_dev']}><Diagnostics /></RequireRole></ProtectedRoute>} />
            <Route path="/admin/bot-qa" element={<ProtectedRoute><RequireRole role={['tenant_admin', 'admin_dev']}><BotQA /></RequireRole></ProtectedRoute>} />
            <Route path="/qa" element={<ProtectedRoute><QACenter /></ProtectedRoute>} />
            <Route path="/repair-access" element={<RepairTechAccess />} />
            <Route path="/quote/tech" element={<TechQuoteSubmit />} />
            <Route path="/quote/review" element={<ClientQuoteReview />} />
            <Route path="/claim/accept/:token" element={<ClaimAcceptance />} />
            <Route path="/quote/accept" element={<QuoteAcceptance />} />
            <Route path="/activate" element={<ClientActivate />} />
            <Route path="/sms/opt-in" element={<SmsOptIn />} />
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client" element={<ProtectedRoute><RequireRole role="client_user"><ClientDashboard /></RequireRole></ProtectedRoute>} />
            <Route path="/client/items" element={<ProtectedRoute><RequireRole role="client_user"><ClientItems /></RequireRole></ProtectedRoute>} />
            <Route path="/client/quotes" element={<ProtectedRoute><RequireRole role="client_user"><ClientQuotes /></RequireRole></ProtectedRoute>} />
            <Route path="/client/shipments" element={<ProtectedRoute><RequireRole role="client_user"><ClientShipments /></RequireRole></ProtectedRoute>} />
            <Route path="/client/shipments/new" element={<ProtectedRoute><RequireRole role="client_user"><ClientInboundCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/client/shipments/outbound/new" element={<ProtectedRoute><RequireRole role="client_user"><ClientOutboundCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/client/shipments/:id" element={<ProtectedRoute><RequireRole role="client_user"><ClientShipmentDetail /></RequireRole></ProtectedRoute>} />
            <Route path="/client/tasks/new" element={<ProtectedRoute><RequireRole role="client_user"><ClientTaskCreate /></RequireRole></ProtectedRoute>} />
            <Route path="/client/claims" element={<ProtectedRoute><RequireRole role="client_user"><ClientClaims /></RequireRole></ProtectedRoute>} />
            <Route path="/components-demo" element={<ProtectedRoute><ComponentsDemo /></ProtectedRoute>} />
            <Route path="/material-icons" element={<ProtectedRoute><MaterialIconsSample /></ProtectedRoute>} />
            <Route path="/print-preview" element={<PrintPreview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIBotSwitch />
          </SidebarProvider>
          </PromptProvider>
        </AuthProvider>
        </AppleBannerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
