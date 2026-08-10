package main
import (
	"fmt"
	"net/http"
	"io"
)
func main() {
	resp, _ := http.Get("http://127.0.0.1:8080/api/student/menu")
	b, _ := io.ReadAll(resp.Body)
	fmt.Println(string(b))
}
