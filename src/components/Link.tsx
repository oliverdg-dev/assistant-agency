import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { isPlainLeftClick, navigate, pathForPage, type Page, type RouteParams } from "../lib/router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: Page;
  params?: RouteParams;
};

// A real <a href> (copy link, open in new tab and middle-click all work) that
// navigates in-app on a plain left click.
export function Link({ to, params, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (isPlainLeftClick(event)) {
      event.preventDefault();
      navigate(to, params);
    }
  };

  return (
    <a href={pathForPage(to, params)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
