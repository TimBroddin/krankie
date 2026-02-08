import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput, Select, StatusMessage, Spinner } from "@inkjs/ui";
import { addKeyword, getAppByAppId, listApps, type App } from "../../db";
import { checkRanking } from "../../scraper/appstore";
import type { Platform } from "../../config";

type Step = "app" | "keyword" | "store" | "saving" | "done" | "error";

interface AddKeywordProps {
  /** Pre-selected app (when adding from AppDetail view) */
  app?: App;
  onDone: () => void;
}

const COMMON_STORES = [
  { label: "us — United States", value: "us" },
  { label: "gb — United Kingdom", value: "gb" },
  { label: "ca — Canada", value: "ca" },
  { label: "au — Australia", value: "au" },
  { label: "de — Germany", value: "de" },
  { label: "fr — France", value: "fr" },
  { label: "nl — Netherlands", value: "nl" },
  { label: "be — Belgium", value: "be" },
  { label: "it — Italy", value: "it" },
  { label: "es — Spain", value: "es" },
  { label: "jp — Japan", value: "jp" },
  { label: "kr — South Korea", value: "kr" },
  { label: "br — Brazil", value: "br" },
  { label: "in — India", value: "in" },
  { label: "se — Sweden", value: "se" },
];

export function AddKeyword({ app: preselectedApp, onDone }: AddKeywordProps): React.ReactElement {
  const [step, setStep] = useState<Step>(preselectedApp ? "keyword" : "app");
  const [apps, setApps] = useState<App[]>([]);
  const [selectedApp, setSelectedApp] = useState<App | undefined>(preselectedApp);
  const [keyword, setKeyword] = useState("");
  const [store, setStore] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Load apps on mount if no preselected app
  React.useEffect(() => {
    if (!preselectedApp) {
      listApps().then(setApps);
    }
  }, [preselectedApp]);

  const handleAppSelect = async (appId: string) => {
    const app = await getAppByAppId(appId);
    if (app) {
      setSelectedApp(app);
      setStep("keyword");
    }
  };

  const handleKeywordSubmit = (value: string) => {
    if (value.trim()) {
      setKeyword(value.trim());
      setStep("store");
    }
  };

  const handleStoreSelect = async (storeCode: string) => {
    setStore(storeCode);
    setStep("saving");

    try {
      await addKeyword(selectedApp!.app_id, keyword, storeCode);

      // Quick rank check
      try {
        const rankResult = await checkRanking(
          selectedApp!.app_id,
          keyword,
          storeCode,
          selectedApp!.platform as Platform
        );
        if (rankResult.rank) {
          setResult(`Added "${keyword}" (${storeCode}) — rank #${rankResult.rank}`);
        } else {
          setResult(`Added "${keyword}" (${storeCode}) — not in top 200`);
        }
      } catch {
        setResult(`Added "${keyword}" (${storeCode})`);
      }

      setStep("done");
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        setError(`"${keyword}" already exists for this app in ${storeCode}`);
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
      setStep("error");
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Add Keyword</Text>
        {selectedApp && (
          <Text dimColor> — {selectedApp.name ?? selectedApp.app_id}</Text>
        )}
      </Box>

      {step === "app" && apps.length > 0 && (
        <Box flexDirection="column">
          <Text>Select app:</Text>
          <Select
            options={apps.map((a) => ({
              label: a.name ?? a.app_id,
              value: a.app_id,
            }))}
            onChange={handleAppSelect}
          />
        </Box>
      )}

      {step === "app" && apps.length === 0 && (
        <Text dimColor>No apps tracked. Add one with 'krankie app create'.</Text>
      )}

      {step === "keyword" && (
        <Box flexDirection="column">
          <Box>
            <Text>Keyword: </Text>
            <TextInput
              placeholder="enter keyword..."
              onSubmit={handleKeywordSubmit}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to confirm • Esc to cancel</Text>
          </Box>
        </Box>
      )}

      {step === "store" && (
        <Box flexDirection="column">
          <Text>Store for "{keyword}":</Text>
          <Select
            options={COMMON_STORES}
            onChange={handleStoreSelect}
          />
        </Box>
      )}

      {step === "saving" && (
        <Spinner label={`Adding "${keyword}" (${store})...`} />
      )}

      {step === "done" && (
        <Box flexDirection="column">
          <StatusMessage variant="success">{result}</StatusMessage>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back</Text>
          </Box>
        </Box>
      )}

      {step === "error" && (
        <Box flexDirection="column">
          <StatusMessage variant="error">{error}</StatusMessage>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
