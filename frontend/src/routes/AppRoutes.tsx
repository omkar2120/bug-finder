import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProjectLayout } from "@/layouts/ProjectLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectFormPage } from "@/pages/ProjectFormPage";
import { ProjectOverviewPage } from "@/pages/ProjectOverviewPage";
import {
  ProjectAccessibilityPage,
  ProjectApisPage,
  ProjectBugsPage,
  ProjectContentPage,
  ProjectPerformancePage,
  ProjectReportsPage,
  ProjectRunsPage,
  ProjectSettingsPage,
} from "@/pages/ProjectCollectionPages";
import { TestRunPage } from "@/pages/TestRunPage";
import { BugDetailPage } from "@/pages/BugDetailPage";
import { ApiDetailPage } from "@/pages/ApiDetailPage";

function Protected() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>
      <Route element={<Protected />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="runs" element={<ProjectRunsPage />} />
            <Route path="bugs" element={<ProjectBugsPage />} />
            <Route path="apis" element={<ProjectApisPage />} />
            <Route path="content" element={<ProjectContentPage />} />
            <Route path="accessibility" element={<ProjectAccessibilityPage />} />
            <Route path="performance" element={<ProjectPerformancePage />} />
            <Route path="reports" element={<ProjectReportsPage />} />
            <Route path="settings" element={<ProjectSettingsPage />} />
          </Route>
          <Route path="/test-runs/:testRunId" element={<TestRunPage />} />
          <Route path="/bugs/:bugId" element={<BugDetailPage />} />
          <Route path="/api-requests/:requestId" element={<ApiDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
