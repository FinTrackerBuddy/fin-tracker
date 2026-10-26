import {
  type GoogleSheetsLedgerConfiguration,
  getMonthlyLedgerA1Range,
} from "./config.js";
import type { GoogleSheetsApiClient } from "./sheets-api.js";

export interface ExpenseLedgerTransaction {
  sourceSheet: string;
  sourceRow: number;
  dateSerial: number;
  date: string;
  description: string;
  debitAmount?: number;
  creditAmount?: number;
  debitCategory?: string;
  creditCategory?: string;
  account: string;
}

export class GoogleSheetsLedgerReader {
  public constructor(
    private readonly configuration: GoogleSheetsLedgerConfiguration,
    private readonly sheetsApi: GoogleSheetsApiClient,
  ) {}

  /**
   * Reads only the requested configured tabs when a selection is supplied.
   * Omitting the selection preserves the all-months behavior for callers that
   * genuinely need the complete ledger.
   */
  public async readMonthlyLedger(
    requestedMonthTabs?: readonly string[],
  ): Promise<ExpenseLedgerTransaction[]> {
    const transactions: ExpenseLedgerTransaction[] = [];
    const monthTabs = requestedMonthTabs ?? this.configuration.monthTabs;

    for (const sheetName of monthTabs) {
      const range = getMonthlyLedgerA1Range(
        sheetName,
        this.configuration.ledgerRange,
      );
      let response;
      try {
        response = await this.sheetsApi.getValues(
          this.configuration.spreadsheetId,
          range,
        );
      } catch (error) {
        throw new Error(
          `Unable to read monthly ledger tab "${sheetName}".`,
          { cause: error },
        );
      }

      response.values.forEach((row, index) => {
        if (isBlankRow(row)) {
          return;
        }

        transactions.push(
          mapLedgerRow(sheetName, index + 9, row),
        );
      });
    }

    return transactions;
  }
}

function mapLedgerRow(
  sheetName: string,
  rowNumber: number,
  row: unknown[],
): ExpenseLedgerTransaction {
  const context = `${sheetName}!A${rowNumber}`;
  const dateSerial = requiredDateSerial(row[0], context);
  const description = requiredText(row[1], `${sheetName}!B${rowNumber}`);
  let debitAmount = optionalAmount(row[2], `${sheetName}!C${rowNumber}`);
  let creditAmount = optionalAmount(row[3], `${sheetName}!D${rowNumber}`);
  const debitCategory = optionalText(row[4], `${sheetName}!E${rowNumber}`);
  const creditCategory = optionalText(row[5], `${sheetName}!F${rowNumber}`);
  const account = requiredText(row[6], `${sheetName}!G${rowNumber}`);

  // Some ledger rows record their side/category but leave the amount blank.
  // The side is still unambiguous, so treat that value as zero rather than
  // rejecting an otherwise valid row. A row without exactly one category is
  // still malformed because its debit/credit side cannot be determined.
  if (debitAmount === undefined && creditAmount === undefined) {
    if (debitCategory && !creditCategory) {
      debitAmount = 0;
    } else if (creditCategory && !debitCategory) {
      creditAmount = 0;
    }
  }

  if ((debitAmount === undefined) === (creditAmount === undefined)) {
    throw malformedRow(
      context,
      "exactly one of DR AMOUNT or CR AMOUNT must be populated",
    );
  }

  if (debitAmount !== undefined && !debitCategory) {
    throw malformedRow(context, "a debit amount requires TYPE (IF DEBIT)");
  }
  if (creditAmount !== undefined && !creditCategory) {
    throw malformedRow(context, "a credit amount requires TYPE (IF CREDIT)");
  }
  if (debitAmount !== undefined && creditCategory) {
    throw malformedRow(context, "a debit row must not set TYPE (IF CREDIT)");
  }
  if (creditAmount !== undefined && debitCategory) {
    throw malformedRow(context, "a credit row must not set TYPE (IF DEBIT)");
  }

  return {
    sourceSheet: sheetName,
    sourceRow: rowNumber,
    dateSerial,
    date: googleSheetsSerialToIsoDate(dateSerial),
    description,
    debitAmount,
    creditAmount,
    debitCategory,
    creditCategory,
    account,
  };
}

export function googleSheetsSerialToIsoDate(serial: number): string {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const baseDate = Date.UTC(1899, 11, 30);
  return new Date(baseDate + Math.floor(serial) * millisecondsPerDay)
    .toISOString()
    .slice(0, 10);
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((value) => value === undefined || value === null || value === "");
}

function requiredDateSerial(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw malformedRow(context, "DATE must be a positive Google Sheets date serial");
  }
  return value;
}

function optionalAmount(value: unknown, context: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw malformedRow(context, "amount must be a non-negative number");
  }
  return value;
}

function requiredText(value: unknown, context: string): string {
  const text = optionalText(value, context);
  if (!text) {
    throw malformedRow(context, "a non-empty text value is required");
  }
  return text;
}

function optionalText(value: unknown, context: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw malformedRow(context, "text values must be strings");
  }
  const text = value.trim();
  return text || undefined;
}

function malformedRow(context: string, detail: string): Error {
  return new Error(`Malformed ledger row at ${context}: ${detail}.`);
}
