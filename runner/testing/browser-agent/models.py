from pydantic import BaseModel, Field
from typing import List, Optional

# IMPORTANT: Keep in sync with `system.md` and `models.ts`.


class Failure(BaseModel):
    """Details about a failed step in a User Journey."""

    step: int = Field(..., description="The step number where the failure occurred.")
    observed: str = Field(
        ..., description="The observed behavior that deviated from the expectation."
    )
    expected: str = Field(..., description="The expected behavior for the failed step.")
    screenshot: str = Field(
        ..., description="Screenshot of the page when the step failed."
    )


class UserJourneyAnalysis(BaseModel):
    """Analysis of a single User Journey."""

    journey: str = Field(..., description="The name of the User Journey.")
    passing: bool = Field(
        ..., description="Whether the User Journey passed or not'."
    )
    steps: List[str] = Field(
        ..., description="The sequence of steps executed for the User Journey."
    )
    failure: Optional[Failure] = Field(
        None,
        description="Details of the failure, if the User Journey failed.",
    )


class Category(BaseModel):
    """Evaluation of a single quality category."""

    name: str = Field(
        ..., description="The name of the quality category being evaluated."
    )
    message: str = Field(
        ...,
        description="A concise summary of missing or improvement areas. Can be empty if none.",
    )


class QualityEvaluation(BaseModel):
    """Holistic quality evaluation of the application."""

    rating: int = Field(
        ..., ge=1, le=10, description="An overall quality rating from 1 to 10."
    )
    summary: str = Field(
        ...,
        description="A concise summary of the application's key features and overall quality.",
    )
    categories: List[Category] = Field(
        ..., description="A list of detailed evaluations for each quality category."
    )


class AgentOutput(BaseModel):
    """The final structured output from the agent."""

    analysis: List[UserJourneyAnalysis] = Field(
        ..., description="An array of user journey analysis objects."
    )
    qualityEvaluation: QualityEvaluation = Field(
        ..., description="The overall quality evaluation."
    )


class TakeFailureScreenshotParams(BaseModel):
    expectation: str = Field(
        ..., description="The expected behavior that deviated from the expectation."
    )
    actual: str = Field(
        ..., description="The actual behavior that deviated from the expectation."
    )
    description: str = Field(
        ..., description="A description of the User Journey."
    )


class FailureScreenshot(TakeFailureScreenshotParams):
    """A screenshot associated with a User Journey failure."""

    base64Screenshot: str = Field(
        ..., description="The base64-encoded screenshot data."
    )
