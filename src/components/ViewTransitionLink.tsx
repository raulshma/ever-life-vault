import React from 'react';
import { Link, LinkProps, useNavigate } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
}

export const ViewTransitionLink: React.FC<ViewTransitionLinkProps> = ({ to, children, ...props }) => {
  const navigate = useNavigate();
  const { viewTransitionsEnabled } = useSettings();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!viewTransitionsEnabled || !('startViewTransition' in document)) {
      return; // Let the default Link behavior handle navigation
    }

    e.preventDefault();
    
    // Use view transitions API if available and enabled
    (document as any).startViewTransition(() => {
      navigate(to as string);
    });
  };

  return (
    <Link to={to} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};