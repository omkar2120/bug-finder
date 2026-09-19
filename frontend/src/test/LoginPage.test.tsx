import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LoginPage } from "@/pages/LoginPage";
import { AuthContext } from "@/stores/auth";

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    render(
      <AuthContext.Provider value={{ user: null, setUser: () => undefined }}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText(/Sign in to BugPilot AI/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/)).toBeInTheDocument();
  });
});
