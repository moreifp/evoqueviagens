import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ehHostLanding, limparHost } from "./site";

/** Host da requisição (servidor) ou da janela (navegador). */
export const hostAtual = createIsomorphicFn()
  .server(() => {
    const h = getRequest().headers;
    return limparHost(h.get("x-forwarded-host") ?? h.get("host"));
  })
  .client(() => window.location.hostname);

export const noHostLanding = () => ehHostLanding(hostAtual());
