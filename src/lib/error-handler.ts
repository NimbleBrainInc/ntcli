import chalk from "chalk";
import { ManagementApiError } from "./api/client.js";

/**
 * Common error handling utilities
 */
export class ErrorHandler {
  /**
   * Handle and display API errors in a consistent way
   */
  static handleApiError(error: unknown, context: string): void {
    console.error(chalk.red(`❌ ${context} failed`));

    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));

      if (error.isTokenError()) {
        console.log(
          chalk.yellow("   💡 Try logging in again: `ntcli auth login`")
        );
      } else if (error.isNotFoundError()) {
        console.log(
          chalk.yellow(
            "   💡 Check that the resource exists and you have access"
          )
        );
      } else if (error.statusCode === 404) {
        console.log(
          chalk.yellow(
            "   💡 The API endpoint may not be available or the resource was not found"
          )
        );
      } else if (error.statusCode >= 500) {
        console.log(
          chalk.yellow(
            "   💡 The server may be experiencing issues. Please try again later."
          )
        );
      }

      if (process.env.NTCLI_DEBUG) {
        console.log();
        console.log(chalk.gray("Debug info:"));
        console.log(chalk.gray(`  Status: ${error.statusCode}`));
        console.log(chalk.gray(`  Error Code: ${error.errorCode || "N/A"}`));
        if (error.details) {
          console.log(
            chalk.gray(`  Details: ${JSON.stringify(error.details, null, 2)}`)
          );
        }
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));

      if (error.message.includes("fetch")) {
        console.log(
          chalk.yellow("   💡 Check your internet connection and API URL")
        );
      } else if (error.message.includes("Invalid JSON response")) {
        console.log(
          chalk.yellow(
            "   💡 The server returned an unexpected response format"
          )
        );
        console.log(
          chalk.yellow(
            "   💡 This may indicate an API version mismatch or server configuration issue"
          )
        );
      }
    } else {
      console.error(chalk.red("   An unexpected error occurred"));
    }
  }

  /**
   * Handle authentication errors consistently
   */
  static handleAuthError(): void {
    console.error(chalk.red("❌ Authentication required"));
    console.log(chalk.yellow("   💡 Please login first: `ntcli auth login`"));
  }

  /**
   * Handle workspace selection errors consistently
   */
  static handleWorkspaceError(workspaceName?: string): void {
    if (workspaceName) {
      console.error(chalk.red(`❌ Workspace '${workspaceName}' not found`));
    } else {
      console.error(chalk.red("❌ No active workspace"));
    }
    console.log(
      chalk.cyan("   💡 Use `ntcli workspace list` to see available workspaces")
    );
    console.log(
      chalk.cyan(
        "   💡 Use `ntcli workspace switch <name>` to select a workspace"
      )
    );
  }
}
