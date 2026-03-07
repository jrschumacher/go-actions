package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/output"
)

const mergeRetries = 3

// Client is a minimal GitHub API client for PR comments
type Client struct {
	token   string
	apiURL  string
	client  *http.Client
}

// NewClient creates a new GitHub API client
func NewClient(ctx *GitHubContext) *Client {
	apiURL := ctx.APIURL
	if apiURL == "" {
		apiURL = "https://api.github.com"
	}

	return &Client{
		token:  ctx.Token,
		apiURL: strings.TrimSuffix(apiURL, "/"),
		client: &http.Client{},
	}
}

// Comment represents a GitHub issue/PR comment
type Comment struct {
	ID   int64  `json:"id"`
	Body string `json:"body"`
	User struct {
		Type string `json:"type"`
	} `json:"user"`
}

// ListComments gets all comments on a PR
func (c *Client) ListComments(owner, repo string, prNumber int) ([]Comment, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/issues/%d/comments", c.apiURL, owner, repo, prNumber)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list comments: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	var comments []Comment
	if err := json.NewDecoder(resp.Body).Decode(&comments); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return comments, nil
}

// CreateComment creates a new comment on a PR
func (c *Client) CreateComment(owner, repo string, prNumber int, body string) error {
	url := fmt.Sprintf("%s/repos/%s/%s/issues/%d/comments", c.apiURL, owner, repo, prNumber)

	payload := map[string]string{"body": body}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create comment: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetComment fetches a single comment by ID
func (c *Client) GetComment(owner, repo string, commentID int64) (*Comment, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/issues/comments/%d", c.apiURL, owner, repo, commentID)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get comment: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	var comment Comment
	if err := json.NewDecoder(resp.Body).Decode(&comment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &comment, nil
}

// UpdateComment updates an existing comment
func (c *Client) UpdateComment(owner, repo string, commentID int64, body string) error {
	url := fmt.Sprintf("%s/repos/%s/%s/issues/comments/%d", c.apiURL, owner, repo, commentID)

	payload := map[string]string{"body": body}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPatch, url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update comment: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// UpsertComment finds a comment with marker and updates it, or creates new
func (c *Client) UpsertComment(owner, repo string, prNumber int, body, marker string) error {
	comments, err := c.ListComments(owner, repo, prNumber)
	if err != nil {
		return fmt.Errorf("failed to list comments: %w", err)
	}

	// Find existing bot comment with marker
	for _, comment := range comments {
		if comment.User.Type == "Bot" && strings.Contains(comment.Body, marker) {
			return c.UpdateComment(owner, repo, comment.ID, body)
		}
	}

	// No existing comment found, create new
	return c.CreateComment(owner, repo, prNumber, body)
}

// MergeAndUpsertComment finds an existing comment, merges new results into it, and updates.
// If no existing comment is found, creates a new one.
// Uses optimistic retry to handle concurrent updates from parallel CI jobs.
func (c *Client) MergeAndUpsertComment(owner, repo string, prNumber int, newResults *output.Results, marker string) error {
	for attempt := range mergeRetries {
		comments, err := c.ListComments(owner, repo, prNumber)
		if err != nil {
			return fmt.Errorf("failed to list comments: %w", err)
		}

		// Find existing bot comment with marker
		var existingComment *Comment
		for i := range comments {
			if comments[i].User.Type == "Bot" && strings.Contains(comments[i].Body, marker) {
				existingComment = &comments[i]
				break
			}
		}

		if existingComment == nil {
			// No existing comment, create new
			body := FormatComment(newResults)
			return c.CreateComment(owner, repo, prNumber, body)
		}

		// Parse existing data and merge
		existing := ParseCommentData(existingComment.Body)
		merged := MergeResults(existing, newResults)
		body := FormatComment(merged)

		if err := c.UpdateComment(owner, repo, existingComment.ID, body); err != nil {
			return err
		}

		// Verify our results are present (detect race condition)
		updated, err := c.GetComment(owner, repo, existingComment.ID)
		if err != nil {
			// Verification failed but update succeeded — acceptable
			return nil
		}

		updatedData := ParseCommentData(updated.Body)
		if updatedData != nil && containsChecks(updatedData, newResults) {
			return nil
		}

		// Our results were overwritten by a concurrent update — retry
		if attempt < mergeRetries-1 {
			time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
		}
	}

	return fmt.Errorf("failed to merge comment after %d retries (concurrent update conflict)", mergeRetries)
}

// containsChecks returns true if merged contains all checks from incoming
func containsChecks(merged, incoming *output.Results) bool {
	if incoming == nil {
		return true
	}
	mergedMap := make(map[string]bool, len(merged.Checks))
	for _, check := range merged.Checks {
		mergedMap[check.Name] = true
	}
	for _, check := range incoming.Checks {
		if !mergedMap[check.Name] {
			return false
		}
	}
	return true
}

// setHeaders sets common headers for GitHub API requests
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
}
