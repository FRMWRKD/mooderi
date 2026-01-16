"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Prompt Improver Actions Module
 * 
 * Node.js actions for AI-powered prompt improvement.
 * Separated from queries/mutations which don't need Node.js runtime.
 */

// ============================================
// ACTIONS: AI-Powered Improvement
// ============================================

/**
 * Analyze category feedback and suggest improvements
 */
export const analyzeCategory = action({
  args: { categoryKey: v.string() },
  handler: async (ctx, args) => {
    const straicoKey = process.env.STRAICO_API_KEY;
    if (!straicoKey) throw new Error("Missing STRAICO_API_KEY");

    // Get approved suggestions for this category
    const feedback = await ctx.runQuery(api.promptFeedback.listByCategory, {
      categoryKey: args.categoryKey,
      limit: 20,
    });

    const suggestions = feedback.filter(
      (f) => f.type === "suggestion" && f.status === "approved"
    );

    if (suggestions.length === 0) {
      return { success: false, message: "No approved suggestions to analyze" };
    }

    // Get current system prompt for this category
    const category = await ctx.runQuery(api.promptCategories.getByKey, {
      key: args.categoryKey,
    });

    if (!category?.systemPromptId) {
      return { success: false, message: "No system prompt linked to category" };
    }

    const systemPrompt = await ctx.runQuery(api.systemPrompts.getByPromptId, {
      promptId: `category_${args.categoryKey}_v1`,
    });

    if (!systemPrompt) {
      return { success: false, message: "System prompt not found" };
    }

    // Ask AI to analyze suggestions and propose improvements
    const analysisPrompt = `You are an AI prompt engineer improving system prompts for image generation.

Current system prompt for "${category.name}":
---
${systemPrompt.content}
---

Community suggestions (approved by admin):
${suggestions.map((s, i) => `${i + 1}. ${s.content}`).join("\n")}

Analyze these suggestions and propose specific improvements to the system prompt.
Return JSON with:
{
  "improvements": [
    { "type": "add" | "modify" | "remove", "description": "what to change", "rationale": "why" }
  ],
  "proposedPrompt": "the full improved system prompt",
  "confidenceScore": 0.0-1.0
}`;

    const response = await fetch("https://api.straico.com/v1/prompt/completion", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${straicoKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: ["openai/gpt-4o-mini"],
        message: analysisPrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Straico API error: ${error}`);
    }

    const result = await response.json();
    let content = "";

    // Extract content from response
    if (result.data?.completion?.choices?.[0]?.message?.content) {
      content = result.data.completion.choices[0].message.content;
    } else if (result.data?.completions) {
      const modelKeys = Object.keys(result.data.completions);
      if (modelKeys.length > 0) {
        content = result.data.completions[modelKeys[0]]?.completion?.choices?.[0]?.message?.content ?? "";
      }
    }

    // Parse JSON response
    try {
      const cleanContent = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, analysis: JSON.parse(jsonMatch[0]) };
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    return { success: false, rawResponse: content };
  },
});

/**
 * Apply a proposed improvement (admin initiated)
 */
export const applyImprovement = action({
  args: {
    systemPromptId: v.id("systemPrompts"),
    newContent: v.string(),
    changeReason: v.string(),
  },
  handler: async (ctx, args) => {
    // Save version before applying
    await ctx.runMutation(api.promptImprover.saveVersion, {
      systemPromptId: args.systemPromptId,
      changeReason: args.changeReason,
      changedBy: "ai_improver",
    });

    // Apply the improvement
    await ctx.runMutation(api.systemPrompts.update, {
      id: args.systemPromptId,
      content: args.newContent,
    });

    return { success: true };
  },
});
