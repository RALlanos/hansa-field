import React from "react";

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement> | (() => void);
  title?: string;
  "aria-label"?: string;
};

export default function Link({ href, children, onClick, ...props }: LinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && href && href.startsWith("/")) {
      e.preventDefault();
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
