// TanStack-compatible NavLink: shim minimale che mantiene l'API del vecchio
// progetto (className/activeClassName) sopra il <Link> di TanStack Router.
import { Link } from "@tanstack/react-router";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ to, className, activeClassName, children, onClick }, ref) => {
    return (
      <Link
        ref={ref as never}
        to={to as never}
        onClick={onClick}
        className={cn(className)}
        activeProps={{ className: activeClassName ?? "" }}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
export default NavLink;
