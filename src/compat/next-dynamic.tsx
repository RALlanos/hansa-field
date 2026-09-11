import React, { Suspense, lazy } from "react";

export default function dynamic<T extends React.ComponentType<any>>(
  importer: () => Promise<T | { default: T }>,
  options?: { ssr?: boolean; loading?: () => React.ReactNode }
): React.ComponentType<any> {
  const LazyComponent = lazy(async () => {
    const module = await importer();
    return "default" in module ? module : { default: module as unknown as T };
  });

  return function DynamicWrapper(props: any) {
    return (
      <Suspense fallback={options?.loading ? options.loading() : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
