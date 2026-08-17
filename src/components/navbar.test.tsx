import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Navbar } from "@/components/navbar";
import type { Role, SessionUser } from "@/types";

function user(role: Role): SessionUser {
  return {
    id: `${role}-navbar-test`,
    email: `${role}@example.test`,
    name: "Pengguna Uji",
    role,
    emailVerified: true
  };
}

describe("navigasi akun berdasarkan peran", () => {
  it("mengarahkan pelanggan ke portal pelanggan pada navigasi desktop dan seluler", () => {
    const html = renderToStaticMarkup(createElement(Navbar, { user: user("customer") }));

    expect(html.split('href="/dashboard"')).toHaveLength(3);
    expect(html).toContain("Portal Pelanggan");
    expect(html).not.toContain('href="/admin"');
  });

  it.each<Role>(["staff", "admin", "owner"])("mengarahkan peran %s ke panel administrasi", (role) => {
    const html = renderToStaticMarkup(createElement(Navbar, { user: user(role) }));

    expect(html.split('href="/admin"')).toHaveLength(3);
    expect(html).toContain("Panel Administrasi");
    expect(html).not.toContain('href="/dashboard"');
  });
});
