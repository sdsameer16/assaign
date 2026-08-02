package services

import "testing"

func TestParseCloudinaryURL(t *testing.T) {
	cases := []struct {
		url          string
		resourceType string
		publicID     string
		ok           bool
	}{
		{
			url:          "https://res.cloudinary.com/dwu45dipi/image/upload/v1785643763/jgnlulhzrs8mxu2iucpm.pdf",
			resourceType: "image",
			publicID:     "jgnlulhzrs8mxu2iucpm",
			ok:           true,
		},
		{
			url:          "https://res.cloudinary.com/dwu45dipi/image/upload/fl_attachment:file.pdf/v1785643763/jgnlulhzrs8mxu2iucpm.pdf",
			resourceType: "image",
			publicID:     "jgnlulhzrs8mxu2iucpm",
			ok:           true,
		},
		{
			url:          "https://res.cloudinary.com/dwu45dipi/raw/upload/v123/prints/notes.pdf",
			resourceType: "raw",
			publicID:     "prints/notes.pdf",
			ok:           true,
		},
		{
			url: "https://example.com/file.pdf",
			ok:  false,
		},
	}

	for _, c := range cases {
		rt, id, ok := ParseCloudinaryURL(c.url)
		if ok != c.ok {
			t.Fatalf("url=%s ok=%v want %v", c.url, ok, c.ok)
		}
		if !c.ok {
			continue
		}
		if rt != c.resourceType || id != c.publicID {
			t.Fatalf("url=%s got %s/%s want %s/%s", c.url, rt, id, c.resourceType, c.publicID)
		}
	}
}
