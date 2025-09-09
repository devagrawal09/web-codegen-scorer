# How to setup up a new LLM?

If you want to test out a model that isn't yet available in the runner, you can add
support for it by following these steps:

1. Ensure that the provider of the model is supported by Genkit.
2. Find the provider for the model in `runner/codegen/genkit/providers`. If the provider hasn't been implemented yet, do so by creating a new `GenkitModelProvider` and adding it to the `MODEL_PROVIDERS` in `runner/genkit/models.ts`.
3. Add your model to the `GenkitModelProvider` configs.
4. Done! 🎉 You can now run your model by passing `--model=<your model ID>`.
