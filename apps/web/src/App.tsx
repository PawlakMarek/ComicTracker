import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { AuthProvider, useAuth } from "./lib/auth";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LibraryPage from "./pages/LibraryPage";
import PublishersPage from "./pages/PublishersPage";
import PublisherDetailPage from "./pages/PublisherDetailPage";
import SeriesPage from "./pages/SeriesPage";
import SeriesDetailPage from "./pages/SeriesDetailPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import StoryBlocksPage from "./pages/StoryBlocksPage";
import StoryBlockDetailPage from "./pages/StoryBlockDetailPage";
import ReadingOrdersPage from "./pages/ReadingOrdersPage";
import ReadingOrderDetailPage from "./pages/ReadingOrderDetailPage";
import CharactersPage from "./pages/CharactersPage";
import CharacterDetailPage from "./pages/CharacterDetailPage";
import IssuesPage from "./pages/IssuesPage";
import IssueDetailPage from "./pages/IssueDetailPage";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import ImportPage from "./pages/ImportPage";
import ToolsPage from "./pages/ToolsPage";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireAuth>
    <AppShell>{children}</AppShell>
  </RequireAuth>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    <Route
      path="/"
      element={
        <ProtectedLayout>
          <DashboardPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library"
      element={
        <ProtectedLayout>
          <LibraryPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/publishers"
      element={
        <ProtectedLayout>
          <PublishersPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/publishers/:id"
      element={
        <ProtectedLayout>
          <PublisherDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/series"
      element={
        <ProtectedLayout>
          <SeriesPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/series/:id"
      element={
        <ProtectedLayout>
          <SeriesDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/events"
      element={
        <ProtectedLayout>
          <EventsPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/library/events/:id"
      element={
        <ProtectedLayout>
          <EventDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/story-blocks"
      element={
        <ProtectedLayout>
          <StoryBlocksPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/story-blocks/:id"
      element={
        <ProtectedLayout>
          <StoryBlockDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/reading-orders"
      element={
        <ProtectedLayout>
          <ReadingOrdersPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/reading-orders/:id"
      element={
        <ProtectedLayout>
          <ReadingOrderDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/characters"
      element={
        <ProtectedLayout>
          <CharactersPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/characters/:id"
      element={
        <ProtectedLayout>
          <CharacterDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/issues"
      element={
        <ProtectedLayout>
          <IssuesPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/issues/:id"
      element={
        <ProtectedLayout>
          <IssueDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/sessions"
      element={
        <ProtectedLayout>
          <SessionsPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/sessions/:id"
      element={
        <ProtectedLayout>
          <SessionDetailPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/import"
      element={
        <ProtectedLayout>
          <ImportPage />
        </ProtectedLayout>
      }
    />
    <Route
      path="/tools"
      element={
        <ProtectedLayout>
          <ToolsPage />
        </ProtectedLayout>
      }
    />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
