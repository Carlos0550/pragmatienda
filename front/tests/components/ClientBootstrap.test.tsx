import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ClientBootstrap } from "@/components/ClientBootstrap";
import { useAuthStore } from "@/stores/auth";

const initialAuthState = useAuthStore.getState();

describe("ClientBootstrap", () => {
  afterEach(() => {
    cleanup();
    act(() => {
      useAuthStore.setState(initialAuthState);
    });
  });

  it("renders the password setup modal when the authenticated user still has a setup token", () => {
    useAuthStore.setState({
      user: {
        id: "admin-1",
        name: "Admin Test",
        email: "admin@test.com",
        type: "admin",
        role: 1
      },
      loading: false,
      billingRequired: false,
      passwordSetupToken: "setup-token"
    });

    render(
      <ClientBootstrap skipTenantBootstrap>
        <div>Contenido</div>
      </ClientBootstrap>
    );

    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Protegé tu cuenta/i })).toBeInTheDocument();
  });
});
