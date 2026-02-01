package github

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name       string
		ctx        *GitHubContext
		wantAPIURL string
	}{
		{
			name: "default API URL",
			ctx: &GitHubContext{
				Token: "test-token",
			},
			wantAPIURL: "https://api.github.com",
		},
		{
			name: "custom API URL",
			ctx: &GitHubContext{
				Token:  "test-token",
				APIURL: "https://github.enterprise.com/api/v3",
			},
			wantAPIURL: "https://github.enterprise.com/api/v3",
		},
		{
			name: "trailing slash removed",
			ctx: &GitHubContext{
				Token:  "test-token",
				APIURL: "https://api.github.com/",
			},
			wantAPIURL: "https://api.github.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.ctx)
			if client.apiURL != tt.wantAPIURL {
				t.Errorf("apiURL = %v, want %v", client.apiURL, tt.wantAPIURL)
			}
			if client.token != tt.ctx.Token {
				t.Errorf("token = %v, want %v", client.token, tt.ctx.Token)
			}
			if client.client == nil {
				t.Error("http client is nil")
			}
		})
	}
}

func TestListComments(t *testing.T) {
	tests := []struct {
		name         string
		statusCode   int
		responseBody string
		wantComments int
		wantErr      bool
	}{
		{
			name:       "successful list",
			statusCode: http.StatusOK,
			responseBody: `[
				{"id": 1, "body": "First comment", "user": {"type": "User"}},
				{"id": 2, "body": "Bot comment", "user": {"type": "Bot"}}
			]`,
			wantComments: 2,
			wantErr:      false,
		},
		{
			name:         "empty list",
			statusCode:   http.StatusOK,
			responseBody: `[]`,
			wantComments: 0,
			wantErr:      false,
		},
		{
			name:         "not found",
			statusCode:   http.StatusNotFound,
			responseBody: `{"message": "Not Found"}`,
			wantErr:      true,
		},
		{
			name:         "unauthorized",
			statusCode:   http.StatusUnauthorized,
			responseBody: `{"message": "Bad credentials"}`,
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				if !strings.HasSuffix(r.URL.Path, "/issues/1/comments") {
					t.Errorf("unexpected path: %s", r.URL.Path)
				}
				if r.Method != http.MethodGet {
					t.Errorf("unexpected method: %s", r.Method)
				}
				if r.Header.Get("Accept") != "application/vnd.github.v3+json" {
					t.Errorf("unexpected Accept header: %s", r.Header.Get("Accept"))
				}
				if r.Header.Get("Authorization") != "Bearer test-token" {
					t.Errorf("unexpected Authorization header: %s", r.Header.Get("Authorization"))
				}

				w.WriteHeader(tt.statusCode)
				w.Write([]byte(tt.responseBody))
			}))
			defer server.Close()

			client := NewClient(&GitHubContext{
				Token:  "test-token",
				APIURL: server.URL,
			})

			comments, err := client.ListComments("owner", "repo", 1)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListComments() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(comments) != tt.wantComments {
				t.Errorf("ListComments() got %d comments, want %d", len(comments), tt.wantComments)
			}
		})
	}
}

func TestCreateComment(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		wantErr    bool
	}{
		{
			name:       "successful create",
			statusCode: http.StatusCreated,
			body:       "Test comment",
			wantErr:    false,
		},
		{
			name:       "forbidden",
			statusCode: http.StatusForbidden,
			body:       "Test comment",
			wantErr:    true,
		},
		{
			name:       "validation error",
			statusCode: http.StatusUnprocessableEntity,
			body:       "Test comment",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				if !strings.HasSuffix(r.URL.Path, "/issues/1/comments") {
					t.Errorf("unexpected path: %s", r.URL.Path)
				}
				if r.Method != http.MethodPost {
					t.Errorf("unexpected method: %s", r.Method)
				}
				if r.Header.Get("Content-Type") != "application/json" {
					t.Errorf("unexpected Content-Type header: %s", r.Header.Get("Content-Type"))
				}

				// Verify body
				var payload map[string]string
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Errorf("failed to decode request body: %v", err)
				}
				if payload["body"] != tt.body {
					t.Errorf("body = %v, want %v", payload["body"], tt.body)
				}

				w.WriteHeader(tt.statusCode)
				w.Write([]byte(`{"id": 1}`))
			}))
			defer server.Close()

			client := NewClient(&GitHubContext{
				Token:  "test-token",
				APIURL: server.URL,
			})

			err := client.CreateComment("owner", "repo", 1, tt.body)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateComment() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestUpdateComment(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		commentID  int64
		body       string
		wantErr    bool
	}{
		{
			name:       "successful update",
			statusCode: http.StatusOK,
			commentID:  123,
			body:       "Updated comment",
			wantErr:    false,
		},
		{
			name:       "not found",
			statusCode: http.StatusNotFound,
			commentID:  999,
			body:       "Updated comment",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				expectedPath := fmt.Sprintf("/repos/owner/repo/issues/comments/%d", tt.commentID)
				if r.URL.Path != expectedPath {
					t.Errorf("unexpected path: %s, want %s", r.URL.Path, expectedPath)
				}
				if r.Method != http.MethodPatch {
					t.Errorf("unexpected method: %s", r.Method)
				}

				// Verify body
				var payload map[string]string
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Errorf("failed to decode request body: %v", err)
				}
				if payload["body"] != tt.body {
					t.Errorf("body = %v, want %v", payload["body"], tt.body)
				}

				w.WriteHeader(tt.statusCode)
				w.Write([]byte(`{"id": 123}`))
			}))
			defer server.Close()

			client := NewClient(&GitHubContext{
				Token:  "test-token",
				APIURL: server.URL,
			})

			err := client.UpdateComment("owner", "repo", tt.commentID, tt.body)
			if (err != nil) != tt.wantErr {
				t.Errorf("UpdateComment() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestUpsertComment(t *testing.T) {
	tests := []struct {
		name            string
		existingComment *Comment
		marker          string
		body            string
		wantCreate      bool
		wantUpdate      bool
	}{
		{
			name: "update existing bot comment",
			existingComment: &Comment{
				ID:   123,
				Body: "<!-- marker -->Previous comment",
				User: struct {
					Type string `json:"type"`
				}{Type: "Bot"},
			},
			marker:     "<!-- marker -->",
			body:       "<!-- marker -->Updated comment",
			wantCreate: false,
			wantUpdate: true,
		},
		{
			name: "create when no bot comment exists",
			existingComment: &Comment{
				ID:   456,
				Body: "User comment",
				User: struct {
					Type string `json:"type"`
				}{Type: "User"},
			},
			marker:     "<!-- marker -->",
			body:       "<!-- marker -->New comment",
			wantCreate: true,
			wantUpdate: false,
		},
		{
			name: "create when marker doesn't match",
			existingComment: &Comment{
				ID:   789,
				Body: "<!-- other-marker -->Bot comment",
				User: struct {
					Type string `json:"type"`
				}{Type: "Bot"},
			},
			marker:     "<!-- marker -->",
			body:       "<!-- marker -->New comment",
			wantCreate: true,
			wantUpdate: false,
		},
		{
			name:            "create when no comments exist",
			existingComment: nil,
			marker:          "<!-- marker -->",
			body:            "<!-- marker -->New comment",
			wantCreate:      true,
			wantUpdate:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var createCalled, updateCalled bool

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issues/1/comments"):
					// List comments
					comments := []Comment{}
					if tt.existingComment != nil {
						comments = append(comments, *tt.existingComment)
					}
					w.WriteHeader(http.StatusOK)
					json.NewEncoder(w).Encode(comments)

				case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/issues/1/comments"):
					// Create comment
					createCalled = true
					w.WriteHeader(http.StatusCreated)
					w.Write([]byte(`{"id": 999}`))

				case r.Method == http.MethodPatch && strings.Contains(r.URL.Path, "/issues/comments/"):
					// Update comment
					updateCalled = true
					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`{"id": 123}`))

				default:
					t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
					w.WriteHeader(http.StatusBadRequest)
				}
			}))
			defer server.Close()

			client := NewClient(&GitHubContext{
				Token:  "test-token",
				APIURL: server.URL,
			})

			err := client.UpsertComment("owner", "repo", 1, tt.body, tt.marker)
			if err != nil {
				t.Errorf("UpsertComment() error = %v", err)
			}

			if createCalled != tt.wantCreate {
				t.Errorf("createCalled = %v, want %v", createCalled, tt.wantCreate)
			}
			if updateCalled != tt.wantUpdate {
				t.Errorf("updateCalled = %v, want %v", updateCalled, tt.wantUpdate)
			}
		})
	}
}

func TestUpsertCommentListError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"message": "Bad credentials"}`))
	}))
	defer server.Close()

	client := NewClient(&GitHubContext{
		Token:  "invalid-token",
		APIURL: server.URL,
	})

	err := client.UpsertComment("owner", "repo", 1, "body", "marker")
	if err == nil {
		t.Error("UpsertComment() expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to list comments") {
		t.Errorf("unexpected error message: %v", err)
	}
}
