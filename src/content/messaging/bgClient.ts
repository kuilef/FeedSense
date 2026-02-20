import { BgRequest, BgResponse } from "../../shared/contracts";

export const sendBgRequest = <T extends BgResponse>(request: BgRequest): Promise<T> => {
  return chrome.runtime.sendMessage(request) as Promise<T>;
};
